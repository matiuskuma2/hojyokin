# パフォーマンス最適化設計書

作成日: 2026-01-23
対象: 500件以上のデータ表示画面（/subsidies, /agency/search）

---

## 1. 現状の問題点

### 1-1. レンダリングボトルネック

| 問題 | 現状コード | 影響 |
|------|-----------|------|
| 一括DOM更新 | `innerHTML = items.map().join('')` | 500件で数秒のブロック |
| 重複フィルタ | `.filter()` を3回呼び出し | CPU負荷 |
| 全件描画 | 画面外も含めて描画 | メモリ・描画時間 |
| 画像遅延なし | 全画像を即時ロード | 初期表示遅延 |

### 1-2. モバイル固有の問題

| 問題 | 影響 |
|------|------|
| カード幅固定 | 横スクロール発生 |
| タップ領域狭い | 操作ミス |
| 一覧表示量 | スクロール疲れ |
| フォントサイズ | 可読性低下 |

---

## 2. 改善戦略（段階的導入）

### Phase A: 即効性のある改善（1日）

#### A-1. ページネーション導入

```javascript
// 現状: 全件表示
const html = results.map(item => renderCard(item)).join('');

// 改善: ページ単位表示
const PAGE_SIZE = 20;
let currentPage = 1;

function renderPage(page) {
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = results.slice(start, start + PAGE_SIZE);
  const html = pageItems.map(item => renderCard(item)).join('');
  container.innerHTML = html;
  renderPagination(page, Math.ceil(results.length / PAGE_SIZE));
}
```

**効果**: 描画時間 95%削減（500→20件）

#### A-2. 遅延フィルタリング（デバウンス）

```javascript
// 現状: キー入力ごとにフィルタ
input.addEventListener('input', filterResults);

// 改善: 300ms待ってからフィルタ
let filterTimeout;
input.addEventListener('input', () => {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(filterResults, 300);
});
```

**効果**: 入力中のカクつき解消

#### A-3. フィルタ結果キャッシュ

```javascript
// 現状: 毎回全件走査
const countProceed = results.filter(r => r.evaluation.status === 'PROCEED').length;
const countCaution = results.filter(r => r.evaluation.status === 'CAUTION').length;

// 改善: 一度の走査でカウント
const counts = { PROCEED: 0, CAUTION: 0, NO: 0 };
results.forEach(r => {
  const status = r.evaluation?.status || 'NO';
  counts[status] = (counts[status] || 0) + 1;
});
```

**効果**: フィルタ処理 67%削減（3回→1回）

### Phase B: 中期改善（1週間）

#### B-1. 仮想スクロール（Virtual Scroll）

```javascript
// 画面内の要素のみ描画
class VirtualScroller {
  constructor(container, items, rowHeight = 120) {
    this.container = container;
    this.items = items;
    this.rowHeight = rowHeight;
    this.visibleCount = Math.ceil(window.innerHeight / rowHeight) + 2;
  }

  render(scrollTop = 0) {
    const startIndex = Math.floor(scrollTop / this.rowHeight);
    const visibleItems = this.items.slice(startIndex, startIndex + this.visibleCount);
    
    // 上下のスペーサーで全体の高さを維持
    const topSpacer = startIndex * this.rowHeight;
    const bottomSpacer = (this.items.length - startIndex - this.visibleCount) * this.rowHeight;
    
    this.container.innerHTML = `
      <div style="height: ${topSpacer}px"></div>
      ${visibleItems.map(item => this.renderItem(item)).join('')}
      <div style="height: ${Math.max(0, bottomSpacer)}px"></div>
    `;
  }
}
```

**効果**: 1000件でも20件分のDOM

#### B-2. 画像遅延読み込み

```javascript
// loading="lazy" + Intersection Observer
function renderCard(item) {
  return `
    <img 
      loading="lazy" 
      data-src="${item.image}" 
      class="lazy-image"
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
    >
  `;
}

// Intersection Observer で読み込み
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img);
    }
  });
});
```

### Phase C: モバイル最適化

#### C-1. レスポンシブカード設計

```css
/* 現状: 固定幅 */
.subsidy-card { width: 100%; max-width: 800px; }

/* 改善: モバイルファースト */
.subsidy-card {
  width: 100%;
  padding: 12px;
}

@media (min-width: 640px) {
  .subsidy-card { padding: 16px; }
}

@media (min-width: 1024px) {
  .subsidy-card { padding: 20px; }
}
```

#### C-2. モバイル用コンパクトビュー

```javascript
// 画面幅に応じて表示項目を調整
const isMobile = window.innerWidth < 640;

function renderCard(item) {
  if (isMobile) {
    return `
      <div class="p-3 border-b">
        <div class="font-medium text-sm truncate">${item.title}</div>
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>${item.deadline || '期限なし'}</span>
          <span class="text-emerald-600 font-medium">${item.amount || '-'}</span>
        </div>
      </div>
    `;
  }
  // デスクトップ用フル表示
  return renderFullCard(item);
}
```

#### C-3. タップ領域最適化

```css
/* タップ領域を最低44px確保（iOS HIG準拠） */
.tap-target {
  min-height: 44px;
  min-width: 44px;
  padding: 12px;
}

/* フィルタボタンのモバイル対応 */
@media (max-width: 640px) {
  .filter-btn {
    flex: 1;
    justify-content: center;
    padding: 10px 8px;
    font-size: 14px;
  }
}
```

---

## 3. 実装優先順位

| 優先度 | 改善項目 | 対象画面 | 工数 | 効果 |
|--------|----------|----------|------|------|
| 🔴 P0 | ページネーション | /subsidies | 2h | ★★★★★ |
| 🔴 P0 | モバイルカード | /subsidies | 2h | ★★★★☆ |
| 🟡 P1 | デバウンス | 全検索 | 1h | ★★★☆☆ |
| 🟡 P1 | フィルタキャッシュ | /subsidies | 1h | ★★★☆☆ |
| 🟢 P2 | 仮想スクロール | /agency/search | 4h | ★★★★☆ |
| 🟢 P2 | 画像遅延 | 全画面 | 2h | ★★★☆☆ |

---

## 4. KPI（パフォーマンス指標）

### 4-1. 測定対象

| 指標 | 現状目安 | 目標 | 測定方法 |
|------|----------|------|----------|
| 初期表示（500件） | 3-5秒 | <1秒 | Performance API |
| スクロールFPS | 30fps | 60fps | Chrome DevTools |
| メモリ使用量 | 150MB+ | <80MB | Chrome Task Manager |
| モバイルLCP | 4秒+ | <2.5秒 | Lighthouse |

### 4-2. 監視コード

```javascript
// 描画時間計測
function measureRender(name, fn) {
  const start = performance.now();
  fn();
  const duration = performance.now() - start;
  console.log(`[Perf] ${name}: ${duration.toFixed(2)}ms`);
  
  // 500ms超えたら警告
  if (duration > 500) {
    console.warn(`[Perf] Slow render: ${name}`);
  }
}

// 使用例
measureRender('renderSubsidyList', () => {
  document.getElementById('subsidies-list').innerHTML = html;
});
```

---

## 5. モバイルUI設計原則

### 5-1. 画面別レイアウト

#### /subsidies（補助金検索）

```
【モバイル】                【デスクトップ】
┌─────────────┐            ┌─────────────────────────┐
│ 🔍 検索     │            │ 🔍 検索 [条件] [絞込]   │
├─────────────┤            ├─────────────────────────┤
│ [PROCEED 5] │            │ [PROCEED 5][CAUTION 3] │
│ [CAUTION 3] │            │ [NO 2]                  │
├─────────────┤            ├─────────────────────────┤
│ ───────────│            │ ┌─────┐ ┌─────┐        │
│ 補助金タイトル│            │ │カード│ │カード│        │
│ 締切 | 金額  │            │ └─────┘ └─────┘        │
│ ───────────│            │ ┌─────┐ ┌─────┐        │
│ 補助金タイトル│            │ │カード│ │カード│        │
│ 締切 | 金額  │            │ └─────┘ └─────┘        │
└─────────────┘            └─────────────────────────┘
```

#### /agency/search（代理店検索）

```
【モバイル】                【デスクトップ】
┌─────────────┐            ┌─────────────────────────┐
│ 👤 顧客選択 ▼│            │ 👤 顧客: [選択] 企業情報│
├─────────────┤            ├─────────────────────────┤
│ 企業: ○○株式会社│         │ 左同様                   │
│ 📊 情報 80%  │            │                         │
├─────────────┤            └─────────────────────────┘
│ （検索結果）  │
└─────────────┘
```

### 5-2. 共通コンポーネント

```javascript
// モバイル判定ユーティリティ
const device = {
  isMobile: () => window.innerWidth < 640,
  isTablet: () => window.innerWidth >= 640 && window.innerWidth < 1024,
  isDesktop: () => window.innerWidth >= 1024
};

// 画面幅変更時のリレンダー
let lastDeviceType = device.isMobile() ? 'mobile' : 'desktop';
window.addEventListener('resize', debounce(() => {
  const currentType = device.isMobile() ? 'mobile' : 'desktop';
  if (currentType !== lastDeviceType) {
    lastDeviceType = currentType;
    rerender(); // 必要な部分のみ再描画
  }
}, 250));
```

---

## 6. 実装チェックリスト

### Phase A（即効性）

- [ ] `/subsidies` にページネーション追加（20件/ページ）
- [ ] モバイル用コンパクトカード実装
- [ ] フィルタ入力にデバウンス追加
- [ ] ステータスカウントのキャッシュ化

### Phase B（中期）

- [ ] 仮想スクロール検討（500件超の場合）
- [ ] 画像遅延読み込み
- [ ] Service Worker キャッシュ

### Phase C（継続）

- [ ] Lighthouse スコア監視
- [ ] 実ユーザー計測（RUM）導入
- [ ] エラーバウンダリ追加

---

## 7. 実装状況

### /subsidies（補助金検索）- ✅ 実装完了

| 改善項目 | 状態 | 詳細 |
|----------|------|------|
| クライアント側ページネーション | ✅ | PAGE_SIZE = 20件/ページ |
| ステータスカウントキャッシュ | ✅ | 1回の走査でカウント |
| モバイル用コンパクトカード | ✅ | isMobile判定で切替 |
| タップ領域確保 | ✅ | min-height: 44px |
| デバウンス | ✅ | キーワード入力300ms |
| パフォーマンス計測 | ✅ | 500ms超で警告 |

### /agency/search（代理店検索）- 🔄 次回対応

| 改善項目 | 状態 | 詳細 |
|----------|------|------|
| クライアント側ページネーション | 🔄 | 未実装 |
| モバイル用コンパクトカード | 🔄 | 未実装 |

---

## 修正履歴

| 日付 | 内容 |
|------|------|
| 2026-01-23 | 初版作成 |
| 2026-01-23 | /subsidies にパフォーマンス改善実装 |
