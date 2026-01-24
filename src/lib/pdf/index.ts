/**
 * PDF抽出モジュール エクスポート
 * 
 * 使用方法:
 * import { extractAndUpdateSubsidy, batchExtractPdfForms } from '@/lib/pdf';
 */

// メインルータ（A-0: 唯一の入り口）
export {
  extractAndUpdateSubsidy,
  batchExtractPdfForms,
  type ExtractSource,
  type ExtractResult,
  type BatchExtractOptions,
  type BatchExtractResult,
  // 定数
  MIN_TEXT_LEN_FOR_NON_OCR,
  MIN_FORMS,
  MIN_FIELDS_PER_FORM,
  MAX_PDF_FETCH_SIZE,
} from './pdf-extract-router';

// required_forms 抽出（A-2）
export {
  extractRequiredFormsFromText,
  validateFormsResult,
  debugExtractForms,
  type FormsValidationResult,
  DEFAULT_MIN_FORMS,
  DEFAULT_MIN_FIELDS_PER_FORM,
  MAX_FORMS,
  MAX_FIELDS_PER_FORM,
} from './required-forms-extractor';

// 失敗記録（A-3）
export {
  recordPdfFailure,
  resolvePdfFailure,
  recordPdfFailuresBatch,
  getPdfFailures,
  getPdfFailuresSummary,
  ignorePdfFailure,
  reopenPdfFailure,
  type PdfFailureReason,
  type PdfFailureStage,
  type PdfFailureRecord,
  FAILURE_PRIORITY,
  FAILURE_LABELS,
} from './pdf-failures';
