/**
 * Cron スケジューリング用ユーティリティ
 */

export type UpdateFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

function addHoursISO(base: Date, hours: number): string {
  const d = new Date(base.getTime());
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function addDaysISO(base: Date, days: number): string {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * source_registry用: update_freq から次回クロール日時を計算
 */
export function computeNextCrawlAtISO(freq: UpdateFrequency, now = new Date()): string {
  switch (freq) {
    case 'hourly':  return addHoursISO(now, 1);
    case 'daily':   return addDaysISO(now, 1);
    case 'weekly':  return addDaysISO(now, 7);
    case 'monthly': return addDaysISO(now, 30);
    default:        return addDaysISO(now, 7);
  }
}

/**
 * subsidy_lifecycle用: status と priority から次回チェック日時を計算
 * 
 * ルール:
 * - closing_soon: 1時間後（hourly）
 * - open/unknown + priority<=2: 1日後（daily）
 * - open/unknown + priority>2: 7日後（weekly）
 * - scheduled: 7日後（weekly）
 * - closed/suspended: 30日後（monthly）
 */
export function computeNextCheckAtISO(
  status: string,
  priority: number,
  now = new Date()
): { next: string; freq: UpdateFrequency } {
  if (status === 'closing_soon') {
    return { next: addHoursISO(now, 1), freq: 'hourly' };
  }
  if (status === 'open' || status === 'unknown') {
    if (priority <= 2) {
      return { next: addDaysISO(now, 1), freq: 'daily' };
    }
    return { next: addDaysISO(now, 7), freq: 'weekly' };
  }
  if (status === 'scheduled') {
    return { next: addDaysISO(now, 7), freq: 'weekly' };
  }
  // closed_by_deadline / closed_by_budget / suspended など
  return { next: addDaysISO(now, 30), freq: 'monthly' };
}
