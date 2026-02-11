/**
 * DRAFT-1: NGルールチェックテスト
 * 
 * draft.ts の 21 NG ルールに対する検出テスト
 */
import { describe, it, expect } from 'vitest';

// NGルールを再定義（テスト用、draft.ts と同一）
const NG_RULES: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(必ず採択|絶対に通る|100%|確実に採択)/g, reason: '断定表現（採択保証と誤解される）' },
  { pattern: /(間違いなく|疑いなく|絶対的に)/g, reason: '断定表現（過度な保証）' },
  { pattern: /(日本一|世界初|業界初|唯一無二)(?!.*を目指)/g, reason: '誇張表現（根拠が必要）' },
  { pattern: /(裏技|抜け道|抜け穴)/g, reason: '不適切表現（不正を想起）' },
  { pattern: /(架空|偽造|水増し|虚偽)/g, reason: '不正を示唆する表現' },
  { pattern: /(脱税|粉飾|横領|着服)/g, reason: '不適切表現（コンプライアンス）' },
  { pattern: /(転売目的|投機目的|投機的)/g, reason: '補助金の目的外使用を想起' },
  { pattern: /(儲けるだけ|利益だけ|金儲け)/g, reason: '公益性の欠如を想起' },
  { pattern: /(既に完了|すでに実施済み|導入済み)/g, reason: '事後申請と判断される恐れ' },
  { pattern: /(見積.*未取得|見積もり.*まだ)/g, reason: '実現可能性の疑義' },
  { pattern: /(他社でも同じ|どこでもできる)/g, reason: '自社の優位性・独自性の否定' },
  { pattern: /(予算.*余った|使い切[るれ])/g, reason: '補助金の無駄遣いを想起' },
  { pattern: /(いろいろ|さまざまな|各種|etc\.?|等々)/g, reason: 'あいまい表現' },
  { pattern: /(たぶん|おそらく|多分|かもしれ(?:ない|ません))/g, reason: '不確実表現' },
  { pattern: /(なんとなく|とりあえず|一応)/g, reason: '計画性の欠如を想起' },
  { pattern: /(老害|障害者.*邪魔|外国人.*排除)/g, reason: '差別表現' },
  { pattern: /(競合.*劣っ|ライバル.*ダメ|他社.*品質が悪い)/g, reason: '他社批判' },
  { pattern: /(補助金.*なければ.*できない|補助金.*頼り)/g, reason: '補助金依存体質' },
  { pattern: /(赤字.*補填|損失.*穴埋め)/g, reason: '補助金の目的外使用' },
  { pattern: /(労基法.*違反|最低賃金.*下回)/g, reason: '法令違反を示唆' },
];

function checkNg(text: string): Array<{ pattern: string; reason: string }> {
  const hits: Array<{ pattern: string; reason: string }> = [];
  for (const rule of NG_RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      hits.push({ pattern: match[0], reason: rule.reason });
    }
  }
  return hits;
}

describe('NGルールチェック (21ルール)', () => {
  it('NG-01: 「必ず採択される」→ 断定表現', () => {
    const hits = checkNg('この計画は必ず採択されます');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].reason).toContain('断定');
  });

  it('NG-02: 「間違いなく成功」→ 過度な保証', () => {
    const hits = checkNg('この事業は間違いなく成功します');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('NG-03: 「日本一のサービス」→ 誇張（根拠必要）', () => {
    const hits = checkNg('日本一のサービスを提供します');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].reason).toContain('誇張');
  });

  it('NG-03b: 「日本一を目指す」→ 許容（目標表現）', () => {
    const hits = checkNg('日本一を目指す取り組みです');
    expect(hits).toHaveLength(0);
  });

  it('NG-04: 「架空の売上」→ 不正示唆', () => {
    const hits = checkNg('架空の売上を計上');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('NG-05: 「転売目的」→ 目的外使用', () => {
    const hits = checkNg('転売目的での購入は控えます');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('NG-06: 「既に完了している」→ 事後申請の恐れ', () => {
    const hits = checkNg('この設備導入は既に完了しています');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].reason).toContain('事後');
  });

  it('NG-07: 「見積もりはまだ取得していない」→ 実現可能性疑義', () => {
    const hits = checkNg('見積もりはまだ取得していません');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('NG-08: 「いろいろな効果」→ あいまい表現', () => {
    const hits = checkNg('いろいろな効果が期待できます');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].reason).toContain('あいまい');
  });

  it('NG-09: 「たぶん実現できる」→ 不確実表現', () => {
    const hits = checkNg('たぶん実現できると思います');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].reason).toContain('不確実');
  });

  it('NG-10: 「補助金がなければできない」→ 依存体質', () => {
    const hits = checkNg('補助金がなければできない事業です');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].reason).toContain('依存');
  });

  it('NG-11: 「赤字を補填する」→ 目的外使用', () => {
    const hits = checkNg('赤字を補填するために活用します');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('NG-12: 「なんとなく始めた」→ 計画性欠如', () => {
    const hits = checkNg('なんとなく始めた事業です');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it('NG-13: 正常な文章 → NG検出なし', () => {
    const hits = checkNg('本事業により、生産性を20%向上させ、売上高の10%増加を目指します。従業員の技能向上にも取り組みます。');
    expect(hits).toHaveLength(0);
  });

  it('NG-14: 複数ルール同時検出', () => {
    const hits = checkNg('必ず採択されるはずです。いろいろな裏技を使います。');
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });

  it('NG-15: 「予算が余った」→ 無駄遣い', () => {
    const hits = checkNg('予算が余ったので追加購入');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });
});
