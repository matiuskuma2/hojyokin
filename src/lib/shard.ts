/**
 * Shard計算ユーティリティ
 * 
 * 17,000件運用向けに16分割shardを安定計算。
 * crc32(id) % 16 で固定分散（制度が増えても安定）。
 */

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
 * 16分割shard_keyを計算
 * @param id - 補助金ID
 * @returns 0-15 のshard_key
 */
export function shardKey16(id: string): number {
  return crc32(id) % 16;
}

/**
 * 現在時刻からshard番号を計算（Cron用）
 * UTCベースで1時間ごとに異なるshardを処理
 * 16shardを16時間で一周
 * 
 * @param date - 基準日時（デフォルト: 現在）
 * @returns 0-15 のshard番号
 */
export function currentShardByHour(date: Date = new Date()): number {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - 
     Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000
  );
  return (dayOfYear * 24 + date.getUTCHours()) % 16;
}

/**
 * 5分ごとに異なるshardを処理（高頻度Cron用）
 * 16shardを80分で一周
 * 
 * @param date - 基準日時（デフォルト: 現在）
 * @returns 0-15 のshard番号
 */
export function currentShardBy5Min(date: Date = new Date()): number {
  const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return Math.floor(totalMinutes / 5) % 16;
}
