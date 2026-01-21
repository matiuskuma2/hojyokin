-- =============================================================================
-- Migration 0013: パスワード再発行トークン管理
-- 目的: 再発行を"運用できる"状態にする（ハッシュ化・監査・レート制限）
-- =============================================================================
-- 
-- 既存の users.password_reset_token/expires は単純な保存で、以下の問題がある：
-- - トークンが平文で保存される（漏洩リスク）
-- - 履歴が残らない（監査できない）
-- - レート制限ができない（DoS攻撃に弱い）
-- 
-- このテーブルで上記を解決し、既存フィールドは互換性のため残す
-- =============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,                           -- UUID
  user_id TEXT NOT NULL,
  
  -- トークン管理（セキュリティ）
  token_hash TEXT NOT NULL,                      -- SHA-256ハッシュ（生トークン禁止）
  expires_at TEXT NOT NULL,                      -- ISO8601 有効期限
  used_at TEXT,                                  -- 使用日時（nullなら未使用）
  
  -- 発行元情報（監査用）
  issued_by TEXT,                                -- 発行者（null=本人、user_id=管理者）
  request_ip TEXT,
  request_user_agent TEXT,
  
  -- 使用時情報（監査用）
  used_ip TEXT,
  used_user_agent TEXT,
  
  -- タイムスタンプ
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ハッシュで検索（ログイン時に使用）
CREATE UNIQUE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);

-- ユーザー別の履歴（監査・レート制限）
CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);

-- 有効期限チェック（定期クリーンアップ）
CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens(expires_at);

-- 未使用トークン検索
CREATE INDEX IF NOT EXISTS idx_prt_used ON password_reset_tokens(used_at);

-- 発行者別（管理者監査）
CREATE INDEX IF NOT EXISTS idx_prt_issued_by ON password_reset_tokens(issued_by);
