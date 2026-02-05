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
import { getNormalizedSubsidyDetail, type NormalizedSubsidyDetail } from "../lib/ssot";
import { checkMissingRequirements, type MissingKey } from "../lib/ssot/checkMissingRequirements";
import { logOpenAICost } from "../lib/cost/cost-logger";

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

// =====================================================
// 7) POST /missing-queue/:id/extract-diff - P4-3 差分抽出
// =====================================================
// 
// Freeze-P4-3: 変更時のみ差分抽出
// - PDF取得（最大2本）
// - OpenAI で構造化抽出
// - pending_updates に提案保存
// - 締切のみ auto_applicable = true
//
adminOps.post("/missing-queue/:id/extract-diff", async (c) => {
  const auth = assertSuperAdmin(c);
  if (!auth.ok) return auth.resp;

  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const forceExtract = body.force === true; // 変更なしでも強制抽出

  // 1. チケット取得
  const row = await db
    .prepare(`SELECT * FROM missing_requirements_queue WHERE id = ?`)
    .bind(id)
    .first<QueueRow>();
  if (!row) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "ticket not found" } }, 404);
  }

  // 2. status チェック
  if (row.status !== "ready_for_extract" && row.status !== "awaiting_change" && !forceExtract) {
    return c.json(
      { success: false, error: { code: "INVALID_STATUS", message: `status must be ready_for_extract or awaiting_change. current: ${row.status}` } },
      400
    );
  }

  // 3. PDF URLs 取得
  const pdfUrls = safeParseJsonArray(row.pdf_urls_json);
  if (pdfUrls.length === 0) {
    return c.json(
      { success: false, error: { code: "NO_PDF_URLS", message: "pdf_urls is empty. set-urls first." } },
      400
    );
  }

  // 4. 既存の normalized を取得
  const existingNormalized = await getNormalizedSubsidyDetail(db, row.canonical_id, { debug: false });
  if (!existingNormalized) {
    return c.json(
      { success: false, error: { code: "SUBSIDY_NOT_FOUND", message: "canonical subsidy not found in SSOT" } },
      404
    );
  }

  // 5. PDF テキスト抽出（最大2本、Firecrawl または fetch）
  const extractedTexts: { url: string; text: string; pages: number }[] = [];
  const maxPdfs = Math.min(pdfUrls.length, 2); // コストガード: 最大2本

  for (let i = 0; i < maxPdfs; i++) {
    const pdfUrl = pdfUrls[i];
    try {
      // 簡易テキスト抽出（Firecrawl がない場合はスキップ）
      // TODO: Firecrawl 連携を後で追加
      // 現時点では placeholder として URL と空テキストを返す
      extractedTexts.push({
        url: pdfUrl,
        text: `[PDF抽出未実装] ${pdfUrl}`,
        pages: 0,
      });
    } catch (e: any) {
      console.error(`[extract-diff] PDF fetch error for ${pdfUrl}:`, e.message);
    }
  }

  // 6. OpenAI で構造化抽出（OPENAI_API_KEY が必要）
  const openaiApiKey = c.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return c.json(
      { success: false, error: { code: "OPENAI_NOT_CONFIGURED", message: "OPENAI_API_KEY is not set" } },
      500
    );
  }

  // 7. 抽出プロンプト構築
  const oldNormalized = existingNormalized.normalized;
  const extractionPrompt = buildExtractionPrompt(oldNormalized, extractedTexts);

  // 8. OpenAI API 呼び出し
  let extractionResult: ExtractedChanges | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // コスト効率
        messages: [
          {
            role: "system",
            content: `You are a subsidy information extractor. Extract changes from the provided PDF text and compare with existing data. Output JSON only.`,
          },
          { role: "user", content: extractionPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as OpenAIResponse;
    inputTokens = data.usage?.prompt_tokens || 0;
    outputTokens = data.usage?.completion_tokens || 0;
    // gpt-4o-mini: $0.15/1M input, $0.60/1M output
    costUsd = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);

    const content = data.choices?.[0]?.message?.content || "{}";
    extractionResult = JSON.parse(content) as ExtractedChanges;
  } catch (e: any) {
    // コストログ（失敗時も記録）
    await logOpenAICost(db, {
      model: "gpt-4o-mini",
      inputTokens,
      outputTokens,
      costUsd,
      action: "extract_diff",
      success: false,
      errorMessage: e.message,
      subsidyId: row.canonical_id,
    });

    return c.json(
      { success: false, error: { code: "OPENAI_ERROR", message: e.message } },
      500
    );
  }

  // 9. コストログ（成功）
  await logOpenAICost(db, {
    model: "gpt-4o-mini",
    inputTokens,
    outputTokens,
    costUsd,
    action: "extract_diff",
    success: true,
    subsidyId: row.canonical_id,
    rawUsage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
  });

  // 10. update_detection_log 作成
  const detectionLogId = `DET-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const changesDetected = extractionResult?.changes?.map(c => c.field_path) || [];
  const changeSummary = extractionResult?.summary || "抽出完了";

  await db
    .prepare(`
      INSERT INTO update_detection_log (
        id, subsidy_id, source_url, source_type,
        changes_detected, change_summary, status, auto_applicable
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      detectionLogId,
      row.canonical_id,
      pdfUrls[0] || null,
      "pdf",
      JSON.stringify(changesDetected),
      changeSummary,
      "pending",
      changesDetected.some(p => p.includes("acceptance")) ? 1 : 0 // 締切関連のみ auto
    )
    .run();

  // 11. pending_updates に変更を保存
  const pendingStatements = (extractionResult?.changes || []).map(change => {
    const pendingId = `PU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const isDeadlineChange = change.field_path.includes("acceptance") || change.field_path.includes("deadline");
    
    return db.prepare(`
      INSERT INTO pending_updates (
        id, detection_log_id, subsidy_id, field_path, field_name,
        old_value, new_value, change_type, confidence, source_text, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      pendingId,
      detectionLogId,
      row.canonical_id,
      change.field_path,
      change.field_name,
      change.old_value || null,
      change.new_value || null,
      change.change_type || "modify",
      change.confidence || 0.8,
      change.source_text || null,
      isDeadlineChange ? "auto_applied" : "pending" // 締切のみ自動適用
    );
  });

  if (pendingStatements.length > 0) {
    await db.batch(pendingStatements);
  }

  // 12. チケット status を更新
  await db
    .prepare(`
      UPDATE missing_requirements_queue
      SET status = 'extracting',
          updated_at = datetime('now'),
          updated_by = ?
      WHERE id = ?
    `)
    .bind(auth.user.id, id)
    .run();

  return c.json({
    success: true,
    data: {
      id,
      detection_log_id: detectionLogId,
      changes_count: extractionResult?.changes?.length || 0,
      cost_usd: costUsd,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      summary: changeSummary,
    },
  });
});

// =====================================================
// P4-3 ヘルパー関数
// =====================================================

interface ExtractedChange {
  field_path: string;
  field_name: string;
  old_value?: string;
  new_value?: string;
  change_type: "add" | "modify" | "delete";
  confidence: number;
  source_text?: string;
}

interface ExtractedChanges {
  changes: ExtractedChange[];
  summary: string;
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * 抽出プロンプト構築
 */
function buildExtractionPrompt(
  oldNormalized: NormalizedSubsidyDetail,
  extractedTexts: { url: string; text: string; pages: number }[]
): string {
  const existingData = {
    title: oldNormalized.display.title,
    acceptance: oldNormalized.acceptance,
    overview: oldNormalized.overview,
    eligibility_rules: oldNormalized.content.eligibility_rules.slice(0, 10), // 最初の10件
    required_documents: oldNormalized.content.required_documents.slice(0, 10),
    eligible_expenses: oldNormalized.content.eligible_expenses,
  };

  const pdfTexts = extractedTexts.map((t, i) => `--- PDF ${i + 1}: ${t.url} ---\n${t.text.slice(0, 8000)}`).join("\n\n");

  return `
## 既存データ（SSOT）
\`\`\`json
${JSON.stringify(existingData, null, 2)}
\`\`\`

## 新しいPDFテキスト
${pdfTexts || "(PDFテキスト抽出未実装)"}

## 指示
1. 既存データと新しいPDFテキストを比較し、変更点を抽出してください。
2. 特に以下のフィールドの変更を検出してください:
   - acceptance.acceptance_end（申請締切日）
   - overview.summary（概要）
   - eligibility_rules（申請要件）
   - required_documents（必要書類）
   - eligible_expenses（対象経費）
3. 変更がない場合は changes を空配列にしてください。

## 出力形式（JSON）
{
  "changes": [
    {
      "field_path": "acceptance.acceptance_end",
      "field_name": "申請締切日",
      "old_value": "2026-03-31",
      "new_value": "2026-06-30",
      "change_type": "modify",
      "confidence": 0.95,
      "source_text": "申請締切：令和8年6月30日"
    }
  ],
  "summary": "申請締切日が2026年6月30日に延長されました。"
}
`;
}

export default adminOps;
