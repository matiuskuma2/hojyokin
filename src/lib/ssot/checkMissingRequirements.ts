/**
 * checkMissingRequirements.ts
 *
 * Freeze Gate v1:
 * - 必須キー判定
 * - priority / severity 計算
 * - 対象制度フィルタ（壁打ち成立が必要な主要制度のみ）
 */
import type { NormalizedSubsidyDetail } from "./normalizeSubsidyDetail";

export type MissingKey =
  | "overview.summary"
  | "content.eligibility_rules"
  | "content.required_documents"
  | "content.eligible_expenses"
  | "provenance.koubo_source_urls_or_pdf_urls"
  | "wall_chat.questions" // 推奨
  | "electronic_application.portal_url"; // 電子申請時のみ必須

export type MissingSeverity = "low" | "normal" | "high" | "urgent";

export interface MissingCheckResult {
  is_target_program: boolean;
  missing_keys: MissingKey[];
  missing_summary: string;
  severity: MissingSeverity;
  priority: number; // 0..100
  debug: {
    days_to_deadline: number | null;
    is_accepting: boolean;
    title: string;
  };
}

// 対象制度（壁打ちが成立しない制度のみ）
const TARGET_PROGRAM_RE = /(IT導入|ものづくり|持続化|業務改善|省力化)/;

/**
 * 締切までの日数を計算
 */
function daysUntil(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * 不足キーを人間向け要約に変換
 */
function summarizeKeys(keys: MissingKey[]): string {
  if (keys.length === 0) return "不足なし";
  const label = (k: MissingKey): string => {
    switch (k) {
      case "overview.summary": return "概要";
      case "content.eligibility_rules": return "申請要件";
      case "content.required_documents": return "必要書類";
      case "content.eligible_expenses": return "対象経費";
      case "provenance.koubo_source_urls_or_pdf_urls": return "根拠URL/PDF";
      case "wall_chat.questions": return "壁打ち質問";
      case "electronic_application.portal_url": return "電子申請URL";
    }
  };
  return `不足: ${keys.map(label).join(" / ")}`;
}

/**
 * Freeze Gate v1 判定
 * 
 * @param n NormalizedSubsidyDetail v1.0
 * @returns MissingCheckResult
 */
export function checkMissingRequirements(n: NormalizedSubsidyDetail): MissingCheckResult {
  const title = n.display.title || "";
  const isTarget = TARGET_PROGRAM_RE.test(title);

  const missing: MissingKey[] = [];

  // ========================================
  // 必須（壁打ち成立の最低限）
  // ========================================
  
  // overview.summary
  if (!n.overview.summary || n.overview.summary.trim().length < 10) {
    missing.push("overview.summary");
  }
  
  // content.eligibility_rules
  if (!Array.isArray(n.content.eligibility_rules) || n.content.eligibility_rules.length < 1) {
    missing.push("content.eligibility_rules");
  }
  
  // content.required_documents
  if (!Array.isArray(n.content.required_documents) || n.content.required_documents.length < 1) {
    missing.push("content.required_documents");
  }
  
  // content.eligible_expenses
  if (
    !n.content.eligible_expenses ||
    !Array.isArray(n.content.eligible_expenses.categories) ||
    n.content.eligible_expenses.categories.length < 1
  ) {
    missing.push("content.eligible_expenses");
  }
  
  // provenance（根拠URL/PDF）
  const hasProvenance =
    (Array.isArray(n.provenance.koubo_source_urls) && n.provenance.koubo_source_urls.length > 0) ||
    (Array.isArray(n.provenance.pdf_urls) && n.provenance.pdf_urls.length > 0);
  if (!hasProvenance) {
    missing.push("provenance.koubo_source_urls_or_pdf_urls");
  }

  // ========================================
  // 推奨（薄い壁打ちを改善したい時）
  // ========================================
  if (!Array.isArray(n.wall_chat.questions) || n.wall_chat.questions.length < 3) {
    missing.push("wall_chat.questions");
  }

  // ========================================
  // 電子申請時のみ必須
  // ========================================
  if (n.electronic_application.is_electronic_application) {
    if (!n.electronic_application.portal_url) {
      missing.push("electronic_application.portal_url");
    }
  }

  // ========================================
  // 優先度/緊急度（凍結ルール）
  // ========================================
  const days = daysUntil(n.acceptance.acceptance_end);
  const isAccepting = n.acceptance.is_accepting === true;

  let severity: MissingSeverity = "normal";
  let priority = 50;

  if (!isTarget) {
    // 対象外は low に落として運用コストを抑える（必要ならignoredに回す）
    severity = "low";
    priority = 90;
  } else if (isAccepting) {
    // 受付中：締切までの日数で緊急度を決定
    if (days !== null && days <= 7) {
      severity = "urgent";
      priority = 5;
    } else if (days !== null && days <= 14) {
      severity = "urgent";
      priority = 10;
    } else if (days !== null && days <= 30) {
      severity = "high";
      priority = 20;
    } else {
      severity = "high";
      priority = 30;
    }
  } else {
    // 受付中ではない
    severity = "normal";
    priority = 60;
  }

  // 不足がゼロなら優先度は下げる（ただしisTarget判定のdebugのため残す）
  if (missing.length === 0) {
    severity = "low";
    priority = 100;
  }

  return {
    is_target_program: isTarget,
    missing_keys: missing,
    missing_summary: summarizeKeys(missing),
    severity,
    priority,
    debug: {
      days_to_deadline: days,
      is_accepting: isAccepting,
      title,
    },
  };
}
