/**
 * URLからドメインキーを抽出
 * go.jp / lg.jp は3階層維持、その他は2階層
 */
export function extractDomainKey(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const parts = hostname.split('.');
    
    // xxx.go.jp / xxx.lg.jp は3階層（例: pref.nara.lg.jp）
    if (parts.length >= 3 && (parts[parts.length - 2] === 'go' || parts[parts.length - 2] === 'lg')) {
      return parts.slice(-3).join('.');
    }
    // 通常は2階層
    if (parts.length >= 2) return parts.slice(-2).join('.');
    return hostname;
  } catch {
    return 'unknown';
  }
}
