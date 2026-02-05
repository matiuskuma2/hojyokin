/**
 * admin-ops.ts
 * 
 * 運用操作系API（Missing Requirements Queue: Freeze Gate v1）
 * - super_admin only
 * - 不足チケット化（Gate）
 * 
 * 責務分離:
 * - admin-dashboard.ts: 可視化/KPI
 * - admin-ops.ts: 運用操作/書き込み系
 */

import { Hono } from "hono";
import type { Env, Variables, ApiResponse } from "../types";
import { requireAuth, getCurrentUser } from "../middleware/auth";
import { getNormalizedSubsidyDetail } from "../lib/ssot";
import { checkMissingRequirements, type MissingKey } from "../lib/ssot/checkMissingRequirements";

// ========================================
// 型定義
// ========================================

interface QueueRow {
  id: string;
  canonical_id: string;
  snapshot_id: string | null;
  cache_id: string | null;
  program_name: string;
  priority: number;
  severity: string;
  missing_keys_json: string;
  missing_summary: string;
  status: string;
  source_urls_json: string | null;
  pdf_urls_json: string | null;
  url_note: string | null;
  monitor_id: string | null;
  monitored_files_count: number;
  firecrawl_budget_pages: number;
  ai_budget_pdfs: number;
  ai_budget_tokens: number;
  created_at: string;
  updated_at: string;
  last_checked_at: string | null;
  resolved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
}

// open系の重複抑制（SQLiteの部分uniqueがないためアプリ側で）
const OPEN_LIKE = ["open", "needs_url", "monitor_registered", "awaiting_change", "ready_for_extract", "extracting"];

// ========================================
// ヘルパー関数
// ========================================

function assertSuperAdmin(c: any): { ok: true; user: any; resp: null } | { ok: false; user: null; resp: Response } {
  const user = getCurrentUser(c);
  if (!user || user.role !== "super_admin") {
    return {
      ok: false,
      user: null,
      resp: c.json(
        { success: false, error: { code: "FORBIDDEN", message: "Super admin access required" } },
        403
      ),
    };
  }
  return { ok: true, user, resp: null };
}

function safeParseJsonArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function uniqHttps(urls: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (typeof u !== "string") continue;
    const trimmed = u.trim();
    if (!/^https:\/\//i.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix = ""): string {
  return prefix ? `${prefix}${crypto.randomUUID()}` : crypto.randomUUID();
}

// ========================================
// Router
// ========================================

const adminOps = new Hono<{ Bindings: Env; Variables: Variables }>();

adminOps.use("*", requireAuth);

// =====================================================
// 1) GET /missing-queue - チケット一覧
// =====================================================
adminOps.get("/missing-queue", async (c) => {
  const auth = assertSuperAdmin(c);
  if (!auth.ok) return auth.resp;

  const db = c.env.DB;
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10), 0);

  const where: string[] = [];
  const params: any[] = [];

  if (status) {
    where.push("status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await db
    .prepare(`SELECT COUNT(*) as cnt FROM missing_requirements_queue ${whereSql}`)
    .bind(...params)
    .first<{ cnt: number }>();
  const total = totalRow?.cnt || 0;

  const itemsRes = await db
    .prepare(
      `
      SELECT *
      FROM missing_requirements_queue
      ${whereSql}
      ORDER BY priority ASC, created_at DESC
      LIMIT ? OFFSET ?
      `
    )
    .bind(...params, limit, offset)
    .all<QueueRow>();

  const countsRes = await db
    .prepare(
      `
      SELECT status, COUNT(*) as cnt
      FROM missing_requirements_queue
      GROUP BY status
      `
    )
    .all<{ status: string; cnt: number }>();

  return c.json<ApiResponse<{ items: QueueRow[] }, any>>({
    success: true,
    data: { items: itemsRes.results || [] },
    meta: {
      schema_version: "gate-v1",
      total,
      status_counts: (countsRes.results || []).reduce((acc: any, r) => {
        acc[r.status] = r.cnt;
        return acc;
      }, {}),
      limit,
      offset,
    },
  });
});

// =====================================================
// 2) POST /missing-queue/recompute - 不足チケット自動生成/更新
// =====================================================
adminOps.post("/missing-queue/recompute", async (c) => {
  const auth = assertSuperAdmin(c);
  if (!auth.ok) return auth.resp;

  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));

  const limit = Math.min(Number(body.limit ?? 500), 2000);
  const onlyActive = body.only_active !== false;
  const onlyTargetPrograms = body.only_target_programs !== false;

  const canonWhere = [onlyActive ? "c.is_active = 1" : "1=1", "c.latest_snapshot_id IS NOT NULL"]
    .filter(Boolean)
    .join(" AND ");

  // 走査母集団
  const canonRes = await db
    .prepare(
      `
      SELECT c.id, c.name, c.latest_snapshot_id, c.latest_cache_id
      FROM subsidy_canonical c
      WHERE ${canonWhere}
      ORDER BY c.id ASC
      LIMIT ?
      `
    )
    .bind(limit)
    .all<{ id: string; name: string; latest_snapshot_id: string; latest_cache_id: string }>();

  let scanned = 0;
  let created = 0;
  let updated = 0;
  let resolved = 0;
  let ignored = 0;
  let errors = 0;

  for (const row of canonRes.results || []) {
    scanned++;

    try {
      const ssot = await getNormalizedSubsidyDetail(db, row.id);
      if (!ssot) continue;

      const check = checkMissingRequirements(ssot.normalized);

      if (onlyTargetPrograms && !check.is_target_program) {
        // 対象外は基本 ignored に落とす（運用コスト最小）
        // open系チケットがあれば ignored にする
        const existing = await db
          .prepare(
            `
            SELECT id, status FROM missing_requirements_queue
            WHERE canonical_id = ?
              AND status IN (${OPEN_LIKE.map(() => "?").join(",")})
            ORDER BY created_at DESC
            LIMIT 1
            `
          )
          .bind(row.id, ...OPEN_LIKE)
          .first<{ id: string; status: string }>();

        if (existing?.id) {
          await db
            .prepare(
              `UPDATE missing_requirements_queue
               SET status='ignored', updated_at=datetime('now'), resolved_at=datetime('now'), updated_by=?
               WHERE id=?`
            )
            .bind(auth.user.id, existing.id)
            .run();
          ignored++;
        }
        continue;
      }

      // 不足がないなら open系があれば resolved
      if (check.missing_keys.length === 0) {
        const existing = await db
          .prepare(
            `
            SELECT id, status FROM missing_requirements_queue
            WHERE canonical_id = ?
              AND status IN (${OPEN_LIKE.map(() => "?").join(",")})
            ORDER BY created_at DESC
            LIMIT 1
            `
          )
          .bind(row.id, ...OPEN_LIKE)
          .first<{ id: string; status: string }>();

        if (existing?.id) {
          await db
            .prepare(
              `UPDATE missing_requirements_queue
               SET status='resolved', missing_keys_json='[]', missing_summary='不足なし',
                   updated_at=datetime('now'), resolved_at=datetime('now'),
                   last_checked_at=datetime('now'), updated_by=?
               WHERE id=?`
            )
            .bind(auth.user.id, existing.id)
            .run();
          resolved++;
        }
        continue;
      }

      // open系があれば UPDATE、なければ INSERT
      const existing = await db
        .prepare(
          `
          SELECT id, status, source_urls_json, pdf_urls_json, monitor_id
          FROM missing_requirements_queue
          WHERE canonical_id = ?
            AND status IN (${OPEN_LIKE.map(() => "?").join(",")})
          ORDER BY created_at DESC
          LIMIT 1
          `
        )
        .bind(row.id, ...OPEN_LIKE)
        .first<{
          id: string;
          status: string;
          source_urls_json: string | null;
          pdf_urls_json: string | null;
          monitor_id: string | null;
        }>();

      const missingKeysJson = JSON.stringify(check.missing_keys);
      const missingSummary = check.missing_summary;

      // URL入力状況に応じて status を付与（凍結）
      const sourceUrls = safeParseJsonArray(existing?.source_urls_json || null);
      const pdfUrls = safeParseJsonArray(existing?.pdf_urls_json || null);
      const hasAnyUrl = sourceUrls.length + pdfUrls.length > 0;

      // monitorが無ければ needs_url / monitor_registered を使い分け
      const nextStatus = !hasAnyUrl
        ? "needs_url"
        : existing?.monitor_id
          ? "awaiting_change"
          : "monitor_registered";

      if (existing?.id) {
        await db
          .prepare(
            `
          UPDATE missing_requirements_queue
          SET snapshot_id=?,
              cache_id=?,
              program_name=?,
              priority=?,
              severity=?,
              missing_keys_json=?,
              missing_summary=?,
              status=?,
              last_checked_at=datetime('now'),
              updated_at=datetime('now'),
              updated_by=?
          WHERE id=?
          `
          )
          .bind(
            ssot.ref.snapshot_id,
            ssot.ref.cache_id,
            ssot.normalized.display.title || row.name,
            check.priority,
            check.severity,
            missingKeysJson,
            missingSummary,
            nextStatus,
            auth.user.id,
            existing.id
          )
          .run();
        updated++;
      } else {
        const id = makeId();
        await db
          .prepare(
            `
          INSERT INTO missing_requirements_queue (
            id, canonical_id, snapshot_id, cache_id,
            program_name, priority, severity,
            missing_keys_json, missing_summary,
            status,
            created_at, updated_at, last_checked_at,
            created_by, updated_by
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?,
            datetime('now'), datetime('now'), datetime('now'),
            ?, ?
          )
          `
          )
          .bind(
            id,
            ssot.ref.canonical_id,
            ssot.ref.snapshot_id,
            ssot.ref.cache_id,
            ssot.normalized.display.title || row.name,
            check.priority,
            check.severity,
            missingKeysJson,
            missingSummary,
            hasAnyUrl ? "monitor_registered" : "needs_url",
            auth.user.id,
            auth.user.id
          )
          .run();
        created++;
      }
    } catch (e) {
      errors++;
      // fail-fastはしない（事故防止：全体を止めない）
      console.error("[missing-queue/recompute] error:", e);
    }
  }

  return c.json<ApiResponse<any, any>>({
    success: true,
    data: { scanned, created, updated, resolved, ignored, errors, at: nowIso() },
    meta: { schema_version: "gate-v1" },
  });
});

// =====================================================
// 3) POST /missing-queue/:id/set-urls - URL登録
// =====================================================
adminOps.post("/missing-queue/:id/set-urls", async (c) => {
  const auth = assertSuperAdmin(c);
  if (!auth.ok) return auth.resp;

  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const sourceUrls = uniqHttps(body.source_urls || []);
  const pdfUrls = uniqHttps(body.pdf_urls || []);
  const note = typeof body.note === "string" ? body.note : null;

  const row = await db
    .prepare(`SELECT * FROM missing_requirements_queue WHERE id = ?`)
    .bind(id)
    .first<QueueRow>();
  if (!row) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "ticket not found" } }, 404);
  }

  // status更新（凍結）
  // URLが入ったら needs_url -> monitor_registered（monitor未作成）
  const nextStatus =
    sourceUrls.length + pdfUrls.length === 0
      ? "needs_url"
      : row.monitor_id
        ? row.status
        : "monitor_registered";

  await db
    .prepare(
      `
    UPDATE missing_requirements_queue
    SET source_urls_json=?,
        pdf_urls_json=?,
        url_note=?,
        status=?,
        updated_at=datetime('now'),
        updated_by=?
    WHERE id=?
    `
    )
    .bind(JSON.stringify(sourceUrls), JSON.stringify(pdfUrls), note, nextStatus, auth.user.id, id)
    .run();

  return c.json({
    success: true,
    data: { id, status: nextStatus, source_urls: sourceUrls, pdf_urls: pdfUrls },
  });
});

// =====================================================
// 4) POST /missing-queue/:id/register-monitor - 監視登録
// =====================================================
adminOps.post("/missing-queue/:id/register-monitor", async (c) => {
  const auth = assertSuperAdmin(c);
  if (!auth.ok) return auth.resp;

  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const row = await db
    .prepare(`SELECT * FROM missing_requirements_queue WHERE id = ?`)
    .bind(id)
    .first<QueueRow>();
  if (!row) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "ticket not found" } }, 404);
  }

  const sourceUrls = safeParseJsonArray(row.source_urls_json);
  const pdfUrls = safeParseJsonArray(row.pdf_urls_json);

  if (sourceUrls.length + pdfUrls.length === 0) {
    return c.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "URLs are required. set-urls first." } },
      400
    );
  }

  // monitor作成
  const monitorId = `MONITOR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const primaryUrl = sourceUrls[0] || pdfUrls[0];

  const checkIntervalHours = Number(body.check_interval_hours ?? 168);
  const urlPatterns = Array.isArray(body.url_patterns) ? body.url_patterns : ["\\.pdf$"];
  const notes = typeof body.notes === "string" ? body.notes : row.url_note || "";

  // data_source_monitors 既存スキーマ前提
  await db
    .prepare(
      `
    INSERT INTO data_source_monitors (
      id, subsidy_cache_id, source_name, source_url, monitor_type,
      check_interval_hours, url_patterns, status, notes,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, 'webpage',
      ?, ?, 'active', ?,
      datetime('now'), datetime('now')
    )
    `
    )
    .bind(
      monitorId,
      row.cache_id,
      `Gate Monitor: ${row.program_name}`,
      primaryUrl,
      checkIntervalHours,
      JSON.stringify(urlPatterns),
      notes
    )
    .run();

  // monitored_files 登録（任意）
  let filesCount = 0;
  const files = Array.isArray(body.files) ? body.files : [];

  for (const f of files) {
    const fileId = `MF-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const fileName = typeof f.file_name === "string" ? f.file_name : "公募要領";
    const urlPattern = typeof f.url_pattern === "string" ? f.url_pattern : ".*\\.pdf$";
    const fileType = typeof f.file_type === "string" ? f.file_type : "pdf";
    const importance = typeof f.importance === "string" ? f.importance : "high";

    await db
      .prepare(
        `
      INSERT INTO monitored_files (
        id, monitor_id, file_name, url_pattern, file_type, importance, status,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 'active',
        datetime('now'), datetime('now')
      )
      `
      )
      .bind(fileId, monitorId, fileName, urlPattern, fileType, importance)
      .run();

    filesCount++;
  }

  // チケット更新
  await db
    .prepare(
      `
    UPDATE missing_requirements_queue
    SET monitor_id=?,
        monitored_files_count=?,
        status='awaiting_change',
        updated_at=datetime('now'),
        updated_by=?
    WHERE id=?
    `
    )
    .bind(monitorId, filesCount, auth.user.id, id)
    .run();

  return c.json({
    success: true,
    data: { id, monitor_id: monitorId, monitored_files_count: filesCount, status: "awaiting_change" },
  });
});

// =====================================================
// 5) POST /missing-queue/:id/mark-ready-for-extract - 抽出準備完了
// =====================================================
adminOps.post("/missing-queue/:id/mark-ready-for-extract", async (c) => {
  const auth = assertSuperAdmin(c);
  if (!auth.ok) return auth.resp;

  const db = c.env.DB;
  const id = c.req.param("id");

  const row = await db
    .prepare(`SELECT * FROM missing_requirements_queue WHERE id = ?`)
    .bind(id)
    .first<QueueRow>();
  if (!row) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "ticket not found" } }, 404);
  }
  if (!row.monitor_id) {
    return c.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "monitor_id is required. register-monitor first." } },
      400
    );
  }

  // 変更検知があるか（pending）確認
  const pending = await db
    .prepare(
      `
    SELECT COUNT(*) as cnt
    FROM file_change_history
    WHERE monitor_id = ?
      AND process_status = 'pending'
    `
    )
    .bind(row.monitor_id)
    .first<{ cnt: number }>();

  const hasChange = (pending?.cnt || 0) > 0;

  const nextStatus = hasChange ? "ready_for_extract" : "awaiting_change";

  await db
    .prepare(
      `
    UPDATE missing_requirements_queue
    SET status=?,
        updated_at=datetime('now'),
        updated_by=?
    WHERE id=?
    `
    )
    .bind(nextStatus, auth.user.id, id)
    .run();

  return c.json({ success: true, data: { id, status: nextStatus, pending_changes: pending?.cnt || 0 } });
});

// =====================================================
// 6) POST /missing-queue/:id/resolve - 手動解決/無視
// =====================================================
adminOps.post("/missing-queue/:id/resolve", async (c) => {
  const auth = assertSuperAdmin(c);
  if (!auth.ok) return auth.resp;

  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const action = body.action as "resolved" | "ignored";
  const note = typeof body.note === "string" ? body.note : null;

  if (action !== "resolved" && action !== "ignored") {
    return c.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "action must be 'resolved' or 'ignored'" } },
      400
    );
  }

  await db
    .prepare(
      `
    UPDATE missing_requirements_queue
    SET status=?,
        url_note=COALESCE(?, url_note),
        resolved_at=datetime('now'),
        updated_at=datetime('now'),
        updated_by=?
    WHERE id=?
    `
    )
    .bind(action, note, auth.user.id, id)
    .run();

  return c.json({ success: true, data: { id, status: action } });
});

export default adminOps;
