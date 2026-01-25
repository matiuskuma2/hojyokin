/**
 * Shard計算ユーティリティ
 * 
 * ★ v3.5.2: 64分割shardで偏り対策
 * crc32(id) % 64 で固定分散（制度が増えても安定）。
 */

// SHARD_COUNT: 偏り対策のため 16 → 64 に拡張
export const SHARD_COUNT = 64;

// CRC32テーブル（軽量版）
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * CRC32ハッシュ計算
 */
export function crc32(str: string): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ str.charCodeAt(i)) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * ★ v3.5.2: 64分割shard_keyを計算
 * @param id - 補助金ID
 * @returns 0-63 のshard_key
 */
export function shardKey16(id: string): number {
  return crc32(id) % SHARD_COUNT;
}

/**
 * ★ v3.5.2: 現在時刻からshard番号を計算（Cron用）
 * UTCベースで1時間ごとに異なるshardを処理
 * 64shardを64時間（約2.7日）で一周
 * 
 * @param date - 基準日時（デフォルト: 現在）
 * @returns 0-63 のshard番号
 */
export function currentShardByHour(date: Date = new Date()): number {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - 
     Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000
  );
  return (dayOfYear * 24 + date.getUTCHours()) % SHARD_COUNT;
}

/**
 * ★ v3.5.2: 5分ごとに異なるshardを処理（高頻度Cron用）
 * 64shardを320分（約5時間20分）で一周
 * 
 * @param date - 基準日時（デフォルト: 現在）
 * @returns 0-63 のshard番号
 */
export function currentShardBy5Min(date: Date = new Date()): number {
  const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return Math.floor(totalMinutes / 5) % SHARD_COUNT;
}

/**
 * ★ v3.5.2: 対角shard（偏り対策: 反対側のshardを同時に処理）
 * 
 * @param date - 基準日時（デフォルト: 現在）
 * @returns 0-63 のshard番号（currentShardBy5Minの対角）
 */
export function oppositeShardBy5Min(date: Date = new Date()): number {
  const primary = currentShardBy5Min(date);
  return (primary + Math.floor(SHARD_COUNT / 2)) % SHARD_COUNT;
}
