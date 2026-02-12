-- 地雷1対策: canonical_id バッチ解決のパフォーマンス用インデックス
-- cache fast path で subsidy_cache.id → subsidy_canonical.latest_cache_id の逆引きに使用
-- 500件×チャンク100件のIN句クエリが高速化される
CREATE INDEX IF NOT EXISTS idx_canonical_latest_cache_id ON subsidy_canonical(latest_cache_id);
