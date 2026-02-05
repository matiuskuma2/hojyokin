/**
 * SSOT モジュール エクスポート
 */

export {
  resolveSubsidyRef,
  resolveSubsidyRefOrThrow,
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
