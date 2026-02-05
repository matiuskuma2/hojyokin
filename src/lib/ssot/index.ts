/**
 * SSOT モジュール エクスポート
 * 
 * A-3-0: getNormalizedSubsidyDetail を追加（全API共通のSSOT読み取り関数）
 */

export {
  resolveSubsidyRef,
  // resolveSubsidyRefOrThrow は内部用途のみ（throw は外部API向けに非推奨）
  type ResolveSubsidyRefResult,
  type SourceType,
  type MatchType,
  type SourceLink,
} from './resolveSubsidyRef';

export {
  normalizeSubsidyDetail,
  safeJsonParse,
  type NormalizedSubsidyDetail,
  type NormalizedIds,
  type NormalizedSource,
  type NormalizedAcceptance,
  type NormalizedDisplay,
  type NormalizedOverview,
  type NormalizedElectronicApplication,
  type NormalizedWallChat,
  type WallChatQuestion,
  type EligibilityRule,
  type ExpenseRequired,
  type ExpenseCategory,
  type EligibleExpenses,
  type RequiredDocument,
  type BonusPoint,
  type RequiredForm,
  type Attachment,
  type NormalizedContent,
  type NormalizedProvenance,
  type PdfHash,
  type NormalizeInput,
} from './normalizeSubsidyDetail';

// A-3-0: 共通読み取り関数（全APIで使用）
export {
  getNormalizedSubsidyDetail,
  // getNormalizedSubsidyDetailOrThrow は内部用途のみ（throw は外部API向けに非推奨）
  type GetNormalizedSubsidyDetailResult,
} from './getNormalizedSubsidyDetail';
