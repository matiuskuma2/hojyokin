/**
 * MATCH-1/2/3: 中小企業基本法 業種別SME判定テスト
 * 
 * screening-v2.ts の resolveIndustryCategory / isSmeByLaw テスト
 */
import { describe, it, expect } from 'vitest';
import {
  resolveIndustryCategory,
  isSmeByLaw,
  SME_THRESHOLDS,
  type SmeIndustryCategory,
} from '../src/lib/screening-v2';

// ============================================================
// resolveIndustryCategory テスト
// ============================================================

describe('resolveIndustryCategory', () => {
  it('製造業 → manufacturing', () => {
    expect(resolveIndustryCategory('製造業')).toBe('manufacturing');
  });

  it('建設業 → manufacturing', () => {
    expect(resolveIndustryCategory('建設業')).toBe('manufacturing');
  });

  it('運輸業 → manufacturing', () => {
    expect(resolveIndustryCategory('運輸業')).toBe('manufacturing');
  });

  it('情報通信業 → manufacturing', () => {
    expect(resolveIndustryCategory('情報通信業')).toBe('manufacturing');
  });

  it('卸売業 → wholesale', () => {
    expect(resolveIndustryCategory('卸売業')).toBe('wholesale');
  });

  it('サービス業 → service', () => {
    expect(resolveIndustryCategory('サービス業')).toBe('service');
  });

  it('飲食業 → service', () => {
    expect(resolveIndustryCategory('飲食業')).toBe('service');
  });

  it('宿泊業 → service', () => {
    expect(resolveIndustryCategory('宿泊業')).toBe('service');
  });

  it('医療福祉 → service', () => {
    expect(resolveIndustryCategory('医療福祉')).toBe('service');
  });

  it('教育 → service', () => {
    expect(resolveIndustryCategory('教育')).toBe('service');
  });

  it('小売業 → retail', () => {
    expect(resolveIndustryCategory('小売業')).toBe('retail');
  });

  it('null → manufacturing (デフォルト=最も緩い基準)', () => {
    expect(resolveIndustryCategory(null)).toBe('manufacturing');
  });

  it('その他 → manufacturing (フォールバック)', () => {
    expect(resolveIndustryCategory('その他')).toBe('manufacturing');
  });

  it('空文字 → manufacturing (フォールバック)', () => {
    expect(resolveIndustryCategory('')).toBe('manufacturing');
  });
});

// ============================================================
// SME_THRESHOLDS テスト
// ============================================================

describe('SME_THRESHOLDS', () => {
  it('製造業: 資本金3億円, 従業員300人, 小規模20人', () => {
    const t = SME_THRESHOLDS.manufacturing;
    expect(t.capitalLimit).toBe(300_000_000);
    expect(t.employeeLimit).toBe(300);
    expect(t.smallScaleEmployeeLimit).toBe(20);
  });

  it('卸売業: 資本金1億円, 従業員100人, 小規模5人', () => {
    const t = SME_THRESHOLDS.wholesale;
    expect(t.capitalLimit).toBe(100_000_000);
    expect(t.employeeLimit).toBe(100);
    expect(t.smallScaleEmployeeLimit).toBe(5);
  });

  it('サービス業: 資本金5千万円, 従業員100人, 小規模5人', () => {
    const t = SME_THRESHOLDS.service;
    expect(t.capitalLimit).toBe(50_000_000);
    expect(t.employeeLimit).toBe(100);
    expect(t.smallScaleEmployeeLimit).toBe(5);
  });

  it('小売業: 資本金5千万円, 従業員50人, 小規模5人', () => {
    const t = SME_THRESHOLDS.retail;
    expect(t.capitalLimit).toBe(50_000_000);
    expect(t.employeeLimit).toBe(50);
    expect(t.smallScaleEmployeeLimit).toBe(5);
  });
});

// ============================================================
// isSmeByLaw テスト（中小企業基本法準拠判定）
// ============================================================

describe('isSmeByLaw', () => {
  // === 製造業 ===
  it('製造業: 資本金2億, 従業員15人 → 中小企業 & 小規模', () => {
    const result = isSmeByLaw(200_000_000, 15, 'manufacturing');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(true);
  });

  it('製造業: 資本金2億, 従業員25人 → 中小企業 & 非小規模', () => {
    const result = isSmeByLaw(200_000_000, 25, 'manufacturing');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(false);
  });

  it('製造業: 資本金5億, 従業員500人 → 非中小企業', () => {
    const result = isSmeByLaw(500_000_000, 500, 'manufacturing');
    expect(result.isSme).toBe(false);
    expect(result.isSmallScale).toBe(false);
  });

  it('製造業: 資本金5億, 従業員200人 → 中小企業（従業員OK）', () => {
    // 資本金は超過だが従業員数がOKなのでOR条件で中小企業
    const result = isSmeByLaw(500_000_000, 200, 'manufacturing');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(false);
  });

  // === 卸売業 ===
  it('卸売業: 資本金8千万, 従業員50人 → 中小企業', () => {
    const result = isSmeByLaw(80_000_000, 50, 'wholesale');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(false);
  });

  it('卸売業: 資本金1.5億, 従業員150人 → 非中小企業', () => {
    const result = isSmeByLaw(150_000_000, 150, 'wholesale');
    expect(result.isSme).toBe(false);
    expect(result.isSmallScale).toBe(false);
  });

  it('卸売業: 資本金1.5億, 従業員3人 → 中小企業 & 小規模（従業員OK）', () => {
    const result = isSmeByLaw(150_000_000, 3, 'wholesale');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(true);
  });

  // === サービス業 ===
  it('サービス業: 資本金4千万, 従業員8人 → 中小企業 & 非小規模', () => {
    const result = isSmeByLaw(40_000_000, 8, 'service');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(false);
  });

  it('サービス業: 資本金4千万, 従業員4人 → 中小企業 & 小規模', () => {
    const result = isSmeByLaw(40_000_000, 4, 'service');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(true);
  });

  it('サービス業: 資本金1億, 従業員200人 → 非中小企業', () => {
    const result = isSmeByLaw(100_000_000, 200, 'service');
    expect(result.isSme).toBe(false);
    expect(result.isSmallScale).toBe(false);
  });

  // === 小売業 ===
  it('小売業: 資本金3千万, 従業員30人 → 中小企業', () => {
    const result = isSmeByLaw(30_000_000, 30, 'retail');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(false);
  });

  it('小売業: 資本金3千万, 従業員5人 → 中小企業 & 小規模', () => {
    const result = isSmeByLaw(30_000_000, 5, 'retail');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(true);
  });

  it('小売業: 資本金1億, 従業員80人 → 非中小企業', () => {
    const result = isSmeByLaw(100_000_000, 80, 'retail');
    expect(result.isSme).toBe(false);
    expect(result.isSmallScale).toBe(false);
  });

  // === エッジケース ===
  it('資本金null (個人事業主) → 従業員のみで判定', () => {
    const result = isSmeByLaw(null, 10, 'retail');
    expect(result.isSme).toBe(true);  // capitalOk = true (unknown), employeeOk = true
    expect(result.isSmallScale).toBe(false);  // 10 > 5
  });

  it('資本金null, 従業員3人 → 小規模事業者', () => {
    const result = isSmeByLaw(null, 3, 'service');
    expect(result.isSme).toBe(true);
    expect(result.isSmallScale).toBe(true);
  });

  it('境界値: 製造業 資本金ちょうど3億円 → 中小企業', () => {
    const result = isSmeByLaw(300_000_000, 100, 'manufacturing');
    expect(result.isSme).toBe(true);
  });

  it('境界値: 製造業 従業員ちょうど300人 → 中小企業', () => {
    const result = isSmeByLaw(500_000_000, 300, 'manufacturing');
    expect(result.isSme).toBe(true);  // 従業員がちょうど上限以下
  });

  it('境界値: 小売業 従業員ちょうど50人 → 中小企業', () => {
    const result = isSmeByLaw(100_000_000, 50, 'retail');
    expect(result.isSme).toBe(true);  // 従業員がちょうど上限以下
  });

  it('reason文字列に業種名が含まれる', () => {
    const result = isSmeByLaw(40_000_000, 4, 'service');
    expect(result.reason).toContain('サービス業');
  });
});
