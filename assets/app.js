/**
 * 船橋市 食品営業許可ダッシュボード
 * Data: 船橋市オープンデータカタログ (CKAN Data API)
 * https://data.bodik.jp/dataset/122041_shokuhineigyoukyokasisetu
 */

const RESOURCE_ID = '23b029a9-6c56-4869-8cea-9a9282d50900';
const CKAN_BASE = 'https://bodik-proxy.takahashi-147.workers.dev';
const FUNABASHI_CENTER = [35.6946, 139.9826];

/* ============ カテゴリ定義 ============ */
const CATEGORIES = [
  { key: 'restaurant', label: '飲食店',      match: ['飲食店営業'],         color: '#ff6b6b' },
  { key: 'cafe',       label: '喫茶',        match: ['喫茶店'],             color: '#b08968' },
  { key: 'sweets',     label: '菓子・パン',  match: ['菓子製造', 'パン'],   color: '#ffb4a2' },
  { key: 'meat',       label: '食肉',        match: ['食肉'],               color: '#c9184a' },
  { key: 'fish',       label: '魚介',        match: ['魚介'],               color: '#0096c7' },
  { key: 'dairy',      label: '乳・アイス',  match: ['乳', 'アイスクリーム'], color: '#f4a261' },
  { key: 'food_mfg',   label: '惣菜・麺・豆腐', match: ['そうざい', '麺', '豆腐'], color: '#6a994e' },
  { key: 'storage',    label: '冷凍冷蔵',    match: ['冷凍', '冷蔵'],       color: '#495057' },
  { key: 'other',      label: 'その他',      match: [],                     color: '#adb5bd' },
];
const COLOR_BY_KEY = Object.fromEntries(CATEGORIES.map(c => [c.key, c.color]));

function categorize(type) {
  if (!type) return 'other';
  for (const c of CATEGORIES) {
    for (const m of c.match) if (type.includes(m)) return c.key;
  }
  return 'other';
}

/* ============ 全角数字→半角 ============ */
const Z2H = { '０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9' };
function normalize(s) {
  if (!s) return '';
  return s.replace(/[０-９]/g, c => Z2H[c] || c);
}

function extractChome(addr) {
  if (!addr) return null;
  const a = addr.replace('千葉県船橋市', '').replace('船橋市', '');
  const m = a.match(/^([^\d０-９]+?[\d０-９]*丁目)/);
  if (m) return m[1];
  const m2 = a.match(/^([^\d０-９]+)/);
  if (m2) return m2[1];
  return null;
}

/* ============ アプリ状態 ============ */
const state = {
  records: [],
  totalCount: 0,
  byCategory: {},
  byChome: {},
  byCorp: {},
  newCount: 0,
  contCount: 0,
  monthlyNew: {},
  monthlyExpiry: {},
  map: null,
  cluster: null,
  chomeCoords: {},
  initialMapBuilt: false,
};

/* ============ CKAN API ============ */
async function ckanFetch(action, params) {
  const url = new URL(CKAN_BASE + '/' + action);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error('CKAN ' + action + ' HTTP ' + res.status);
  const data = await res.json();
  if (!data.success) throw new Error('CKAN ' + action + ' returned success=false');
  return data.result;
}

async function fetchAllRecords(onProgress) {
  let result = await ckanFetch('datastore_search', {
    resource_id: RESOURCE_ID,
    limit: 1,
  });
  const total = result.total;
  state.totalCount = total;
  if (onProgress) onProgress(0, total);

  const PAGE = 1000;
  const records = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    result = await ckanFetch('datastore_search', {
      resource_id: RESOURCE_ID,
      limit: PAGE,
      offset,
    });
    records.push(...result.records);
    if (onProgress) onProgress(records.length, total);
  }
  return records;
}

/* ============ 集計 ============ */
function wareki2date(s) {
  if (!s) return null;
  const m = s.match(/^([RHS])(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const [, era, y, mo, d] = m;
  let year = parseInt(y);
  if (era === 'R') year += 2018;
  else if (era === 'H') year += 1988;
  else if (era === 'S') year += 1925;
  return new Date(year, parseInt(mo) - 1, parseInt(d));
}

function aggregate(records) {
  const byCategory = {};
  const byChome = {};
  const byCorp = {};
  const monthlyNew = {};
  const monthlyExpiry = {};
  let newCount = 0, contCount = 0;
  const now = new Date();

  for (const r of records) {
    const type = r['営業の種類'];
    const cat = categorize(type);
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const chome = extractChome(r['営業所所在地']);
    if (chome && chome !== '県内一円町') {
      byChome[chome] = (byChome[chome] || 0) + 1;
    }

    const corp = (r['法人名'] || '').trim();
    if (corp) byCorp[corp] = (byCorp[corp] || 0) + 1;

    const at = r['申請区分'];
    if (at === '新規') newCount++;
    else if (at === '継続') contCount++;

    if (at === '新規') {
      const d = wareki2date(r['許可開始日']);
      if (d) {
        const ymKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyNew[ymKey] = (monthlyNew[ymKey] || 0) + 1;
      }
    }

    const ed = wareki2date(r['許可満了日']);
    if (ed) {
      const monthsAhead = (ed.getFullYear() - now.getFullYear()) * 12 + (ed.getMonth() - now.getMonth());
      if (monthsAhead >= 0 && monthsAhead < 24) {
        monthlyExpiry[monthsAhead] = (monthlyExpiry[monthsAhead] || 0) + 1;
      }
    }
  }

  return { byCategory, byChome, byCorp, monthlyNew, monthlyExpiry, newCount, contCount };
}

/* ============ レンダリング ============ */
function renderKPIs() {
  document.getElementById('kpiTotal').textContent = state.totalCount.toLocaleString();
  document.getElementById('kpiTotalSub').textContent = '件の許可施設';
  const numCats = Object.keys(state.byCategory).length;
  document.getElementById('kpiCats').textContent = numCats;
  document.getElementById('kpiNew').textContent = state.newCount.toLocaleString();
  const newPct = Math.round(state.newCount / state.totalCount * 100);
  document.getElementById('kpiNewSub').textContent = '全体の ' + newPct + '%';
  document.getElementById('kpiCont').textContent = state.contCount.toLocaleString();
  const contPct = Math.round(state.contCount / state.totalCount * 100);
  document.getElementById('kpiContSub').textContent = '全体の ' + contPct + '%';

  document.getElementById('heroSub').textContent =
    state.totalCount.toLocaleString() + '件の最新データ · ' + new Date().toLocaleDateString('ja-JP') + '時点';
}

function getChartTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1d1d1f';
}
function getChartGridColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#e8e8ea';
}

function renderCategoryChart() {
  const sorted = CATEGORIES
    .map(c => ({ cat: c, count: state.byCategory[c.key] || 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);

  document.getElementById('catMeta').textContent = sorted.length + '業種';

  const ctx = document.getElementById('catChart');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(x => x.cat.label),
      datasets: [{
        data: sorted.map(x => x.count),
        backgroundColor: sorted.map(x => x.cat.color),
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = (ctx.parsed / state.totalCount * 100).toFixed(1);
              return ctx.label + ': ' + ctx.parsed.toLocaleString() + '件 (' + pct + '%)';
            }
          }
        }
      }
    }
  });

  const legend = document.getElementById('catLegend');
  legend.innerHTML = '';
  const max = sorted[0].count;
  sorted.forEach(({ cat, count }) => {
    const pct = (count / state.totalCount * 100).toFixed(1);
    const widthPct = count / max * 100;
    const row = document.createElement('div');
    row.className = 'legend-item';
    row.innerHTML =
      '<span class="legend-dot" style="background:' + cat.color + '"></span>' +
      '<span class="legend-label">' + cat.label + '</span>' +
      '<div class="legend-bar-wrap"><div class="legend-bar-fill" style="background:' + cat.color + ';width:0%"></div></div>' +
      '<span class="legend-count">' + count.toLocaleString() + ' <span style="color:var(--text-3)">(' + pct + '%)</span></span>';
    legend.appendChild(row);
    requestAnimationFrame(() => {
      row.querySelector('.legend-bar-fill').style.width = widthPct + '%';
    });
  });
}

function renderAreaChart() {
  const sorted = Object.entries(state.byChome)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const ctx = document.getElementById('areaChart');
  const textColor = getChartTextColor();
  const gridColor = getChartGridColor();
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{
        data: sorted.map(x => x[1]),
        backgroundColor: '#0071e3',
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 18,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ctx.parsed.x + '件' } }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { size: 11 } }
        },
        y: {
          grid: { display: false, drawBorder: false },
          ticks: { color: textColor, font: { size: 12 } }
        }
      }
    }
  });
}

function renderTrendChart() {
  const now = new Date();
  const labels = [];
  const data = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    labels.push((d.getMonth() + 1) + '月');
    data.push(state.monthlyNew[key] || 0);
  }
  const ctx = document.getElementById('trendChart');
  const textColor = getChartTextColor();
  const gridColor = getChartGridColor();
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: data.map((_, i) => i >= 12 ? '#0071e3' : '#aeaeb2'),
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              const d = new Date(now.getFullYear(), now.getMonth() - (23 - idx), 1);
              return d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
            },
            label: (ctx) => '新規許可 ' + ctx.parsed.y + '件'
          }
        }
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: textColor, font: { size: 10 }, maxRotation: 0 }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { size: 11 }, precision: 0 }
        }
      }
    }
  });
}

function renderCorpRank() {
  const sorted = Object.entries(state.byCorp)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const list = document.getElementById('corpRank');
  if (sorted.length === 0) {
    list.innerHTML = '<div class="result-empty">同一法人の複数許可なし</div>';
    return;
  }
  list.innerHTML = '';
  sorted.forEach(([name, count], i) => {
    const row = document.createElement('div');
    row.className = 'rank-row' + (i < 3 ? ' top3' : '');
    row.innerHTML =
      '<div class="rank-num">' + (i + 1) + '</div>' +
      '<div class="rank-name">' + escapeHtml(name) + '</div>' +
      '<div class="rank-count">' + count + '<span class="rank-count-unit">件</span></div>';
    list.appendChild(row);
  });
}

function renderExpiryGrid() {
  const now = new Date();
  const grid = document.getElementById('expiryGrid');
  grid.innerHTML = '';
  const max = Math.max(...Object.values(state.monthlyExpiry).slice(0, 12), 1);
  let totalIn12 = 0;
  for (let i = 0; i < 12; i++) {
    const count = state.monthlyExpiry[i] || 0;
    totalIn12 += count;
    const intensity = count / max;
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const cell = document.createElement('div');
    cell.className = 'expiry-cell';
    const r = Math.round(255 * intensity);
    const g = Math.round(180 * (1 - intensity * 0.7));
    const b = Math.round(220 * (1 - intensity));
    cell.style.background = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.15 + intensity * 0.55) + ')';
    cell.innerHTML =
      '<div class="expiry-cell-month">' + (d.getMonth() + 1) + '月</div>' +
      '<div class="expiry-cell-count">' + count + '</div>';
    grid.appendChild(cell);
  }
  document.getElementById('expiryNote').textContent =
    '今後12ヶ月で ' + totalIn12.toLocaleString() + '件 の許可が満了予定（更新申請の対象）';
}

/* ============ ユーティリティ ============ */
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ============ 検索 ============ */
function setupSearch() {
  const input = document.getElementById('searchInput');
  const list = document.getElementById('resultList');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => doSearch(input.value, list), 200);
  });
}

function doSearch(query, listEl) {
  const q = query.trim().toLowerCase();
  if (!q) {
    listEl.innerHTML = '<div class="result-empty">検索キーワードを入力してください</div>';
    return;
  }
  const results = state.records.filter(r => {
    const hay = [r['施設名称'], r['営業所所在地'], r['営業の種類'], r['法人名'], r['施設名称_カナ']]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }).slice(0, 100);

  if (results.length === 0) {
    listEl.innerHTML = '<div class="result-empty">該当する施設が見つかりません</div>';
    return;
  }
  listEl.innerHTML = '';
  results.forEach(r => {
    const cat = CATEGORIES.find(c => c.key === categorize(r['営業の種類']));
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML =
      '<div class="result-name">' + escapeHtml(r['施設名称'] || '名称未登録') + '</div>' +
      '<div class="result-meta">' +
        '<span class="result-cat-pill"><span class="legend-dot" style="background:' + cat.color + ';width:7px;height:7px"></span>' + escapeHtml(cat.label) + '</span>' +
        '<span>' + escapeHtml(r['営業所所在地'] || '') + '</span>' +
      '</div>';
    div.addEventListener('click', () => openShopSheet(r));
    listEl.appendChild(div);
  });
  const meta = document.createElement('div');
  meta.style.cssText = 'padding:12px 0;text-align:center;font-size:12px;color:var(--text-3)';
  meta.textContent = results.length === 100 ? '上位100件まで表示' : results.length + '件';
  listEl.appendChild(meta);
}

/* ============ 詳細シート ============ */
function openShopSheet(shop) {
  const cat = CATEGORIES.find(c => c.key === categorize(shop['営業の種類']));
  const fullAddr = (shop['営業所所在地'] || '') + (shop['施設方書'] ? ' ' + shop['施設方書'] : '');
  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(fullAddr);
  const tel = shop['施設電話番号'] || '';

  const content = document.getElementById('sheetContent');
  content.innerHTML =
    '<div class="sheet-header">' +
      '<div class="sheet-title">' + escapeHtml(shop['施設名称'] || '名称未登録') + '</div>' +
      '<div class="sheet-meta">' +
        '<span class="result-cat-pill">' +
          '<span class="legend-dot" style="background:' + cat.color + ';width:7px;height:7px"></span>' +
          escapeHtml(shop['営業の種類'] || cat.label) +
        '</span>' +
        (shop['申請区分'] ? '<span>· ' + escapeHtml(shop['申請区分']) + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div class="sheet-body">' +
      '<div class="detail-section">' +
        '<div class="detail-label">所在地・連絡先</div>' +
        '<div class="detail-row">' +
          '<div class="detail-key">住所</div>' +
          '<div class="detail-val">' + escapeHtml(shop['営業所所在地'] || '—') + (shop['施設方書'] ? '<br>' + escapeHtml(shop['施設方書']) : '') + '</div>' +
        '</div>' +
        (tel ? '<div class="detail-row"><div class="detail-key">電話</div><div class="detail-val"><a href="tel:' + escapeHtml(tel) + '">' + escapeHtml(tel) + '</a></div></div>' : '') +
        (shop['法人名'] ? '<div class="detail-row"><div class="detail-key">法人名</div><div class="detail-val">' + escapeHtml(shop['法人名']) + '</div></div>' : '') +
      '</div>' +
      '<div class="detail-section">' +
        '<div class="detail-label">許可情報</div>' +
        (shop['許可番号'] ? '<div class="detail-row"><div class="detail-key">許可番号</div><div class="detail-val">' + escapeHtml(shop['許可番号']) + '</div></div>' : '') +
        (shop['初回許可年月日'] ? '<div class="detail-row"><div class="detail-key">初回許可</div><div class="detail-val">' + escapeHtml(shop['初回許可年月日']) + '</div></div>' : '') +
        (shop['許可開始日'] ? '<div class="detail-row"><div class="detail-key">許可開始</div><div class="detail-val">' + escapeHtml(shop['許可開始日']) + '</div></div>' : '') +
        (shop['許可満了日'] ? '<div class="detail-row"><div class="detail-key">許可満了</div><div class="detail-val">' + escapeHtml(shop['許可満了日']) + '</div></div>' : '') +
        (shop['許可条件'] ? '<div class="detail-row"><div class="detail-key">許可条件</div><div class="detail-val">' + escapeHtml(shop['許可条件']) + '</div></div>' : '') +
        (shop['備考'] ? '<div class="detail-row"><div class="detail-key">備考</div><div class="detail-val">' + escapeHtml(shop['備考']) + '</div></div>' : '') +
      '</div>' +
      '<div class="btn-row">' +
        '<a class="btn btn-primary" href="' + mapsUrl + '" target="_blank" rel="noopener">地図で開く</a>' +
        (tel ? '<a class="btn" href="tel:' + escapeHtml(tel) + '">電話</a>' : '') +
      '</div>' +
    '</div>';

  document.getElementById('sheet').classList.add('visible');
  document.getElementById('sheetBackdrop').classList.add('visible');
}

function closeSheet() {
  document.getElementById('sheet').classList.remove('visible');
  document.getElementById('sheetBackdrop').classList.remove('visible');
}

/* ============ タブ切替 ============ */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.view;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.view').forEach(v => {
        v.classList.toggle('active', v.id === target);
      });
      if (target === 'mapView' && !state.initialMapBuilt) {
        initMap();
        state.initialMapBuilt = true;
      } else if (target === 'mapView' && state.map) {
        setTimeout(() => state.map.invalidateSize(), 100);
      }
    });
  });
}

/* ============ 地図 ============ */
const CHOME_FALLBACK = {
  '本町1丁目':[35.6946,139.9826],'本町2丁目':[35.6960,139.9836],'本町3丁目':[35.6975,139.9851],
  '本町4丁目':[35.6985,139.9866],'本町5丁目':[35.7000,139.9881],'本町6丁目':[35.7012,139.9895],
  '本町7丁目':[35.7025,139.9905],'浜町1丁目':[35.6843,139.9886],'浜町2丁目':[35.6840,139.9920],
  '浜町3丁目':[35.6835,139.9960],'前原西1丁目':[35.7142,140.0223],'前原西2丁目':[35.7164,140.0238],
  '前原東1丁目':[35.7150,140.0270],'西船1丁目':[35.7059,139.9492],'西船2丁目':[35.7065,139.9510],
  '西船3丁目':[35.7080,139.9525],'西船4丁目':[35.7099,139.9545],'西船5丁目':[35.7115,139.9558],
  '習志野台1丁目':[35.7247,140.0463],'習志野台2丁目':[35.7270,140.0480],'習志野台3丁目':[35.7290,140.0500],
  '習志野台4丁目':[35.7305,140.0520],'習志野台5丁目':[35.7325,140.0540],'習志野台6丁目':[35.7345,140.0555],
  '習志野台7丁目':[35.7365,140.0570],'習志野台8丁目':[35.7380,140.0585],'高根台1丁目':[35.7240,140.0335],
  '高根台2丁目':[35.7253,140.0355],'高根台3丁目':[35.7268,140.0375],'高根台4丁目':[35.7280,140.0395],
  '高根台5丁目':[35.7295,140.0410],'高根台6丁目':[35.7310,140.0425],'高根台7丁目':[35.7325,140.0440],
  '本中山1丁目':[35.7124,139.9220],'本中山2丁目':[35.7140,139.9240],'本中山3丁目':[35.7155,139.9260],
  '本中山4丁目':[35.7170,139.9280],'本中山5丁目':[35.7185,139.9295],'本中山6丁目':[35.7195,139.9310],
  '本中山7丁目':[35.7210,139.9325],'古作1丁目':[35.7060,139.9305],'古作2丁目':[35.7080,139.9320],
  '高瀬町':[35.6740,140.0026],'山手1丁目':[35.7065,139.9700],'山手2丁目':[35.7080,139.9720],
  '山手3丁目':[35.7095,139.9740],'芝山1丁目':[35.7290,140.0260],'芝山2丁目':[35.7305,140.0280],
  '芝山3丁目':[35.7320,140.0300],'芝山4丁目':[35.7335,140.0320],'芝山5丁目':[35.7350,140.0340],
  '芝山6丁目':[35.7365,140.0360],'芝山7丁目':[35.7380,140.0380],'薬円台1丁目':[35.7180,140.0490],
  '薬円台2丁目':[35.7195,140.0510],'薬円台3丁目':[35.7210,140.0530],'薬円台4丁目':[35.7225,140.0550],
  '薬円台5丁目':[35.7240,140.0570],'薬円台6丁目':[35.7255,140.0590],'行田1丁目':[35.7180,139.9685],
  '行田2丁目':[35.7195,139.9705],'行田3丁目':[35.7210,139.9725],'本郷町':[35.7080,139.9335],
  '若松1丁目':[35.6870,139.9930],'若松2丁目':[35.6885,139.9945],'若松3丁目':[35.6900,139.9960],
  '南本町':[35.6940,139.9810],'咲が丘1丁目':[35.7358,140.0098],'咲が丘2丁目':[35.7373,140.0118],
  '咲が丘3丁目':[35.7388,140.0138],'咲が丘4丁目':[35.7403,140.0158],'市場1丁目':[35.7050,139.9988],
  '市場2丁目':[35.7065,140.0008],'市場3丁目':[35.7080,140.0028],'市場4丁目':[35.7095,140.0048],
  '市場5丁目':[35.7110,140.0068],'印内町':[35.7045,139.9410],'山野町':[35.7070,139.9605],
  '東船橋1丁目':[35.7035,140.0050],'東船橋2丁目':[35.7050,140.0070],'東船橋3丁目':[35.7065,140.0090],
  '東船橋4丁目':[35.7080,140.0110],'東船橋5丁目':[35.7095,140.0130],
  '夏見1丁目':[35.7180,140.0040],'夏見2丁目':[35.7195,140.0060],'夏見3丁目':[35.7210,140.0080],
  '夏見4丁目':[35.7225,140.0100],'夏見5丁目':[35.7240,140.0120],'夏見6丁目':[35.7255,140.0140],
  '宮本1丁目':[35.6960,139.9930],'宮本2丁目':[35.6975,139.9950],'宮本3丁目':[35.6990,139.9970],
  '宮本4丁目':[35.7005,139.9990],'宮本5丁目':[35.7020,140.0010],'宮本6丁目':[35.7035,140.0030],
  '宮本7丁目':[35.7050,140.0050],'宮本8丁目':[35.7065,140.0070],'宮本9丁目':[35.7080,140.0090],
  '海神1丁目':[35.6980,139.9620],'海神2丁目':[35.6995,139.9640],'海神3丁目':[35.7010,139.9660],
  '海神4丁目':[35.7025,139.9680],'海神5丁目':[35.7040,139.9700],'海神6丁目':[35.7055,139.9720],
  '湊町1丁目':[35.6900,139.9830],'湊町2丁目':[35.6915,139.9850],'湊町3丁目':[35.6930,139.9870],
  '三咲1丁目':[35.7460,140.0220],'三咲2丁目':[35.7475,140.0240],'三咲3丁目':[35.7490,140.0260],
  '三咲4丁目':[35.7505,140.0280],'三咲5丁目':[35.7520,140.0300],'三咲町':[35.7470,140.0210],
  '三山1丁目':[35.7090,140.0420],'三山2丁目':[35.7105,140.0440],'三山3丁目':[35.7120,140.0460],
  '三山4丁目':[35.7135,140.0480],'三山5丁目':[35.7150,140.0500],'三山6丁目':[35.7165,140.0520],
  '三山7丁目':[35.7180,140.0540],'三山8丁目':[35.7195,140.0560],'三山9丁目':[35.7210,140.0580],
  '習志野1丁目':[35.7290,140.0420],'習志野2丁目':[35.7305,140.0440],'習志野3丁目':[35.7320,140.0460],
  '習志野4丁目':[35.7335,140.0480],'習志野5丁目':[35.7350,140.0500],
  '金杉1丁目':[35.7340,140.0030],'金杉4丁目':[35.7385,140.0090],'金杉7丁目':[35.7430,140.0150],
  '金杉8丁目':[35.7445,140.0170],'金杉9丁目':[35.7460,140.0190],
  '日の出1丁目':[35.6720,140.0070],'日の出2丁目':[35.6735,140.0090],
  '北本町1丁目':[35.7015,139.9810],'藤原1丁目':[35.7270,139.9840],'藤原2丁目':[35.7285,139.9860],
  '藤原3丁目':[35.7300,139.9880],'藤原5丁目':[35.7330,139.9920],'藤原7丁目':[35.7360,139.9960],
  '坪井東1丁目':[35.7185,140.0640],'坪井東2丁目':[35.7200,140.0660],'坪井東3丁目':[35.7215,140.0680],
  '坪井西2丁目':[35.7195,140.0590],'坪井町':[35.7200,140.0640],'飯山満町1丁目':[35.7140,140.0180],
  '飯山満町2丁目':[35.7155,140.0200],'飯山満町3丁目':[35.7170,140.0220],
  '上山町1丁目':[35.7280,139.9510],'上山町2丁目':[35.7295,139.9530],'上山町3丁目':[35.7310,139.9550],
  '東中山1丁目':[35.7150,139.9170],'東中山2丁目':[35.7165,139.9190],
  '葛飾町2丁目':[35.7080,139.9450],'松が丘1丁目':[35.7400,140.0050],'松が丘3丁目':[35.7430,140.0090],
  '松が丘4丁目':[35.7445,140.0110],'丸山1丁目':[35.7170,139.9395],'丸山2丁目':[35.7185,139.9415],
  '丸山3丁目':[35.7200,139.9435],'丸山4丁目':[35.7215,139.9455],'丸山5丁目':[35.7230,139.9475],
  '二和東1丁目':[35.7610,140.0170],'二和東5丁目':[35.7670,140.0250],'二和東6丁目':[35.7685,140.0270],
  '二和西4丁目':[35.7600,140.0080],'二和西6丁目':[35.7630,140.0120],
  '西習志野1丁目':[35.7240,140.0590],'西習志野2丁目':[35.7255,140.0610],'西習志野3丁目':[35.7270,140.0630],
  '前原西3丁目':[35.7180,140.0250],'前原西4丁目':[35.7195,140.0265],'前原西5丁目':[35.7210,140.0280],
  '前原西6丁目':[35.7225,140.0295],'前原西8丁目':[35.7250,140.0325],
  '前原東4丁目':[35.7195,140.0310],'前原東5丁目':[35.7210,140.0325],'前原東6丁目':[35.7225,140.0340],
  '滝台町':[35.7160,140.0170],'滝台1丁目':[35.7150,140.0160],'潮見町':[35.6720,140.0150],
  '南海神1丁目':[35.6915,139.9650],'海神町2丁目':[35.6940,139.9700],'海神町西1丁目':[35.6900,139.9680],
  '海神町南1丁目':[35.6890,139.9710],'印内1丁目':[35.7035,139.9420],'印内2丁目':[35.7050,139.9440],
  '印内3丁目':[35.7065,139.9460],'前貝塚町':[35.7340,139.9970],'馬込西1丁目':[35.7290,139.9750],
  '馬込西2丁目':[35.7305,139.9770],'馬込町':[35.7280,139.9740],'米ケ崎町':[35.7100,140.0250],
  '中野木1丁目':[35.7050,140.0200],'中野木2丁目':[35.7065,140.0220],'夏見台1丁目':[35.7250,139.9990],
  '夏見台2丁目':[35.7265,140.0010],'夏見台3丁目':[35.7280,140.0030],'夏見台4丁目':[35.7295,140.0050],
  '夏見台町':[35.7260,140.0010],'駿河台1丁目':[35.7140,140.0150],'駿河台2丁目':[35.7155,140.0170],
  '高根町':[35.7370,140.0260],'神保町':[35.7800,140.0700],'大穴町':[35.7560,140.0650],
  '大穴北1丁目':[35.7540,140.0620],'大穴北2丁目':[35.7555,140.0640],'大穴南1丁目':[35.7510,140.0660],
  '大穴南2丁目':[35.7495,140.0680],'大穴南3丁目':[35.7480,140.0700],'金堀町':[35.7900,140.0800],
  '小室町':[35.7980,140.1000],'豊富町':[35.7850,140.0500],'古和釜町':[35.7620,140.0470],
  '田喜野井4丁目':[35.7060,140.0590],'二子町':[35.7200,139.9180],'八木が谷1丁目':[35.7700,140.0480],
  '八木が谷2丁目':[35.7715,140.0500],'みやぎ台2丁目':[35.7440,139.9970],'みやぎ台3丁目':[35.7455,139.9990],
  '小野田町':[35.7920,140.0900],'大神保町':[35.7950,140.0850],'金堀1丁目':[35.7900,140.0810],
  '金杉台1丁目':[35.7475,140.0210],'新高根1丁目':[35.7280,140.0210],'新高根2丁目':[35.7295,140.0230],
  '新高根6丁目':[35.7355,140.0290],'栄町1丁目':[35.6770,139.9890],'栄町2丁目':[35.6785,139.9910],
  'みやぎ台4丁目':[35.7470,140.0010],'南三咲1丁目':[35.7435,140.0190],
  '南三咲2丁目':[35.7420,140.0210],'南三咲3丁目':[35.7405,140.0230],'南三咲4丁目':[35.7390,140.0250],
  '車方町':[35.7820,140.0820],'東町':[35.6850,139.9810],'山手町':[35.7050,139.9690],
};

function initMap() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  state.map = L.map('map', { zoomControl: false }).setView(FUNABASHI_CENTER, 13);

  L.tileLayer(
    isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    { attribution: '© OSM © CARTO', maxZoom: 19 }
  ).addTo(state.map);

  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  state.cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    chunkedLoading: true,
  });
  state.map.addLayer(state.cluster);

  let mapTimer;
  document.getElementById('mapSearchInput').addEventListener('input', (e) => {
    clearTimeout(mapTimer);
    mapTimer = setTimeout(() => buildMapMarkers(e.target.value), 200);
  });

  const allChomes = [...new Set(state.records.map(r => extractChome(r['営業所所在地'])).filter(c => c && c !== '県内一円町'))];
  const needsGeo = [];
  allChomes.forEach(ch => {
    const norm = normalize(ch);
    if (CHOME_FALLBACK[norm]) {
      state.chomeCoords[ch] = CHOME_FALLBACK[norm];
    } else {
      needsGeo.push(ch);
      state.chomeCoords[ch] = [
        FUNABASHI_CENTER[0] + (Math.random() - 0.5) * 0.05,
        FUNABASHI_CENTER[1] + (Math.random() - 0.5) * 0.07
      ];
    }
  });

  buildMapMarkers('');
  geocodeBackground(needsGeo);
}

function buildMapMarkers(query) {
  if (!state.cluster) return;
  state.cluster.clearLayers();
  const q = query.trim().toLowerCase();
  const chomeBuckets = new Map();

  state.records.forEach(r => {
    const ch = extractChome(r['営業所所在地']);
    if (!ch || !state.chomeCoords[ch]) return;
    if (q) {
      const hay = [r['施設名称'], r['営業所所在地'], r['営業の種類'], r['法人名']].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return;
    }
    if (!chomeBuckets.has(ch)) chomeBuckets.set(ch, []);
    chomeBuckets.get(ch).push(r);
  });

  let visibleCount = 0;
  for (const [ch, list] of chomeBuckets) {
    const base = state.chomeCoords[ch];
    list.forEach((r, i) => {
      const coords = jitter(base, i, list.length);
      const cat = categorize(r['営業の種類']);
      const color = COLOR_BY_KEY[cat] || COLOR_BY_KEY.other;
      const marker = L.marker(coords, {
        icon: L.divIcon({
          className: '',
          html: '<div class="cust-marker" style="background:' + color + '"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
      });
      marker.bindPopup(() => {
        const div = document.createElement('div');
        div.innerHTML =
          '<div class="popup-name">' + escapeHtml(r['施設名称'] || '') + '</div>' +
          '<div class="popup-type">' + escapeHtml(r['営業の種類'] || '') + '</div>' +
          '<a class="popup-link" data-action="detail">詳細を見る →</a>';
        div.querySelector('[data-action="detail"]').addEventListener('click', (e) => {
          e.preventDefault();
          state.map.closePopup();
          openShopSheet(r);
        });
        return div;
      });
      state.cluster.addLayer(marker);
      visibleCount++;
    });
  }

  showMapStatus(q ? visibleCount.toLocaleString() + '件 該当' : visibleCount.toLocaleString() + '件 表示中', false);
  setTimeout(hideMapStatus, 1800);
}

function jitter(base, i, total) {
  if (total === 1) return base;
  const radius = 0.0008 + Math.min(0.001, total * 0.00004);
  const angle = (i / total) * 2 * Math.PI + (i * 0.7);
  return [base[0] + Math.cos(angle) * radius, base[1] + Math.sin(angle) * radius];
}

async function geocodeBackground(chomes) {
  if (chomes.length === 0) return;

  const CACHE_KEY = 'funabashi_chome_v1';
  let cache = {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) cache = JSON.parse(raw);
  } catch (e) {}

  let cached = 0;
  chomes.forEach(ch => {
    if (cache[ch]) { state.chomeCoords[ch] = cache[ch]; cached++; }
  });
  if (cached) buildMapMarkers(document.getElementById('mapSearchInput').value);

  const toFetch = chomes.filter(ch => !cache[ch]);
  if (toFetch.length === 0) {
    showMapStatus('位置情報をキャッシュから復元', false);
    setTimeout(hideMapStatus, 2000);
    return;
  }

  showMapStatus('位置情報を取得中… 0/' + toFetch.length, true);

  let done = 0;
  for (const ch of toFetch) {
    try {
      const url = 'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent('千葉県船橋市' + ch) + '&format=json&limit=1&countrycodes=jp&accept-language=ja';
      const res = await fetch(url);
      const data = await res.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (lat > 35.55 && lat < 35.85 && lon > 139.85 && lon < 140.15) {
          state.chomeCoords[ch] = [lat, lon];
          cache[ch] = [lat, lon];
        }
      }
    } catch (e) {}
    done++;
    if (done % 10 === 0 || done === toFetch.length) {
      showMapStatus('位置情報を取得中… ' + done + '/' + toFetch.length, true);
      buildMapMarkers(document.getElementById('mapSearchInput').value);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 1100));
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
  showMapStatus('位置情報の取得完了', false);
  setTimeout(hideMapStatus, 2000);
}

function showMapStatus(text, withSpinner) {
  const el = document.getElementById('mapStatus');
  el.querySelector('.spinner').style.display = withSpinner ? '' : 'none';
  document.getElementById('mapStatusText').textContent = text;
  el.classList.remove('hidden');
}
function hideMapStatus() {
  document.getElementById('mapStatus').classList.add('hidden');
}

/* ============ 起動 ============ */
async function bootstrap() {
  document.getElementById('sheetBackdrop').addEventListener('click', closeSheet);
  document.getElementById('sheet').addEventListener('click', (e) => e.stopPropagation());
  setupTabs();
  setupSearch();

  // Chart.js / Leaflet が defer ロード後であることを確認
  await new Promise(resolve => {
    if (window.Chart && window.L) return resolve();
    const check = setInterval(() => {
      if (window.Chart && window.L) {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });

  try {
    const records = await fetchAllRecords((done, total) => {
      const pct = total ? Math.round(done / total * 100) : 0;
      document.getElementById('bootSub').textContent =
        done.toLocaleString() + ' / ' + total.toLocaleString() + '件 (' + pct + '%)';
    });
    state.records = records;
    const agg = aggregate(records);
    Object.assign(state, agg);

    renderKPIs();
    renderCategoryChart();
    renderAreaChart();
    renderTrendChart();
    renderCorpRank();
    renderExpiryGrid();

    document.getElementById('boot').classList.add('hidden');
    setTimeout(() => {
      const boot = document.getElementById('boot');
      if (boot) boot.style.display = 'none';
    }, 400);

  } catch (e) {
    console.error(e);
    const errEl = document.getElementById('bootError');
    errEl.innerHTML =
      '<strong>データ取得エラー</strong><br>' +
      escapeHtml(e.message) + '<br><br>' +
      'ネットワーク接続を確認の上、ページを再読み込みしてください。';
    errEl.style.display = 'block';
    document.getElementById('bootSub').textContent = '';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
