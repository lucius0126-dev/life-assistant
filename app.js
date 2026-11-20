// 生活助理：畫面與互動。資料只存在這台裝置的 localStorage。
import * as L from './logic.js';

const KEY = 'life-assistant-v1';
const APP_VERSION = '1.0.0';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => L.todayStr();
const hasAmount = v => v !== '' && v != null && !Number.isNaN(Number(v));
const money = v => (hasAmount(v) ? `NT$${Number(v).toLocaleString('zh-TW')}` : '');
const fmtRate = r => `${Number((Number(r) || 0).toFixed(2))}%`;
const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== '' && v != null ? Math.min(hi, Math.max(lo, n)) : d; };

function safeUrl(u) {
  try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; }
}

const CARD_COLORS = ['#334c3d', '#2f4f6f', '#7a3b4a', '#8b5e3c', '#5b5470', '#9a7b3f', '#3a3a3a', '#4f7a73'];
const TOOL_ICONS = ['🎨', '🧮', '🚚', '📦', '🛒', '📅', '💰', '📈', '🏦', '🍳', '💊', '🗺️', '✈️', '📝', '🎵', '🔗'];

const SAMPLE_RECIPES = [
  { name: '番茄炒蛋', tags: ['家常', '快速', '蛋'], ingredients: '番茄 2顆\n雞蛋 3顆\n蔥 1支\n糖 1小匙\n鹽 少許',
    steps: '1. 番茄切塊、蔥切段，蛋打散加一點鹽。\n2. 熱油把蛋炒到半熟先盛起。\n3. 同一鍋炒番茄到出汁，加糖、鹽調味。\n4. 倒回炒蛋和蔥段，拌勻即可。', note: '範例食譜，可以編輯或刪除' },
  { name: '蒜炒高麗菜', tags: ['青菜', '快速'], ingredients: '高麗菜 半顆\n蒜頭 3瓣\n鹽 少許',
    steps: '1. 高麗菜洗淨用手撕片，蒜頭切片。\n2. 熱油爆香蒜片。\n3. 下高麗菜大火快炒，加一點水和鹽，炒軟即可。', note: '範例食譜，可以編輯或刪除' },
  { name: '三杯雞', tags: ['雞肉', '下飯'], ingredients: '雞腿肉 2支\n麻油 2大匙\n醬油 2大匙\n米酒 3大匙\n薑 1段\n蒜頭 6瓣\n九層塔 1把\n糖 1小匙',
    steps: '1. 雞腿肉切塊，薑切片，蒜頭去皮。\n2. 麻油小火把薑片煸到捲曲，加蒜頭炒香。\n3. 下雞肉煎到表面金黃。\n4. 加醬油、米酒、糖，蓋鍋燜煮約 10 分鐘收汁。\n5. 起鍋前放九層塔拌勻。', note: '範例食譜，可以編輯或刪除' },
  { name: '味噌豆腐湯', tags: ['湯', '快速'], ingredients: '豆腐 1盒\n味噌 2大匙\n海帶芽 1小把\n蔥 1支',
    steps: '1. 水煮滾後放入切塊的豆腐和海帶芽。\n2. 轉小火，用湯勺把味噌化開加入，不要再大滾。\n3. 撒上蔥花即可。', note: '範例食譜，可以編輯或刪除' },
];

// ---------- 資料 ----------

function defaults() {
  return {
    v: 1,
    bills: [],
    cards: [],
    recipes: SAMPLE_RECIPES.map(r => normRecipe({ id: uid(), ...r })),
    plan: [],
    shopping: { checked: {}, extra: [] },
    tools: [{ id: uid(), name: '拾色', url: 'https://color.bidezato.com/', icon: '🎨' }],
    ui: { tab: 'home', cat: '超商', menuTab: 'recipes', dishTag: '', pick: null, editTools: false },
    meta: { createdAt: new Date().toISOString(), lastBackupAt: null },
  };
}

function normBill(b) {
  const nextDue = L.isValidDate(b.nextDue) ? b.nextDue : today();
  const every = [0, 1, 2, 3, 6, 12].includes(Number(b.every)) ? Number(b.every) : 1;
  return {
    id: String(b.id || uid()),
    name: String(b.name || '未命名').slice(0, 40),
    amount: hasAmount(b.amount) && Number(b.amount) >= 0 ? Number(b.amount) : '',
    nextDue,
    every,
    anchorDay: clampInt(b.anchorDay, 1, 31, L.parse(nextDue).d),
    autopay: !!b.autopay,
    cardId: String(b.cardId || ''),
    remindDays: clampInt(b.remindDays, 0, 30, 3),
    note: String(b.note || '').slice(0, 300),
    cardBillOf: String(b.cardBillOf || ''),
    doneAt: L.isValidDate(b.doneAt) ? b.doneAt : '',
    lastPaidAt: L.isValidDate(b.lastPaidAt) ? b.lastPaidAt : '',
  };
}

function normCard(c) {
  return {
    id: String(c.id || uid()),
    name: String(c.name || '未命名卡片').slice(0, 30),
    last4: /^\d{4}$/.test(String(c.last4 || '')) ? String(c.last4) : '',
    color: CARD_COLORS.includes(c.color) ? c.color : CARD_COLORS[0],
    statementDay: clampInt(c.statementDay, 1, 31, 1),
    dueDay: clampInt(c.dueDay, 1, 31, 15),
    autopay: !!c.autopay,
    remind: c.remind !== false,
    rewards: (Array.isArray(c.rewards) ? c.rewards : [])
      .map(r => ({ cat: String(r.cat || '').trim().slice(0, 12), rate: Math.max(0, Number(r.rate) || 0), note: String(r.note || '').slice(0, 60) }))
      .filter(r => r.cat),
    fee: String(c.fee || '').slice(0, 60),
    note: String(c.note || '').slice(0, 300),
  };
}

function normRecipe(r) {
  return {
    id: String(r.id || uid()),
    name: String(r.name || '未命名').slice(0, 40),
    tags: Array.isArray(r.tags) ? r.tags.map(String).slice(0, 10) : L.parseTags(r.tags),
    ingredients: String(r.ingredients || '').slice(0, 2000),
    steps: String(r.steps || '').slice(0, 5000),
    link: safeUrl(r.link),
    note: String(r.note || '').slice(0, 500),
  };
}

function normTool(t) {
  return { id: String(t.id || uid()), name: String(t.name || '工具').slice(0, 12), url: safeUrl(t.url), icon: String(t.icon || '').slice(0, 4) };
}

function migrate(s) {
  const d = defaults();
  if (!s || typeof s !== 'object') return d;
  const arr = (v, fallback) => (Array.isArray(v) ? v : fallback);
  const out = {
    v: 1,
    bills: arr(s.bills, []).filter(x => x && typeof x === 'object').map(normBill),
    cards: arr(s.cards, []).filter(x => x && typeof x === 'object').map(normCard),
    recipes: arr(s.recipes, d.recipes).filter(x => x && typeof x === 'object').map(normRecipe),
    plan: arr(s.plan, []).map(String),
    shopping: {
      checked: s.shopping && typeof s.shopping.checked === 'object' && s.shopping.checked ? s.shopping.checked : {},
      extra: arr(s.shopping && s.shopping.extra, []).filter(x => x && x.text).map(x => ({ id: String(x.id || uid()), text: String(x.text).slice(0, 40), done: !!x.done })),
    },
    tools: arr(s.tools, d.tools).filter(x => x && typeof x === 'object').map(normTool).filter(t => t.url),
    ui: { ...d.ui, ...(s.ui && typeof s.ui === 'object' ? s.ui : {}) },
    meta: { ...d.meta, ...(s.meta && typeof s.meta === 'object' ? s.meta : {}) },
  };
  out.plan = out.plan.filter(id => out.recipes.some(r => r.id === id));
  return out;
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('讀取資料失敗', e);
    // 資料壞掉時先另存一份，避免下次儲存把它蓋掉。
    try { if (raw) localStorage.setItem(`${KEY}-broken-${Date.now()}`, raw); } catch { /* 忽略 */ }
  }
  return defaults();
}

let state = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('儲存失敗', e);
    toast('沒辦法儲存：瀏覽器空間不足或封鎖了儲存。請先匯出備份。');
    return false;
  }
}

function rollAll() {
  const t = today();
  let changed = false;
  for (const b of state.bills) {
    const r = L.rollAutopay(b, t);
    if (r) { Object.assign(b, r); changed = true; }
  }
  return changed;
}

const activeBills = () => state.bills.filter(b => !b.doneAt);
const byDue = (a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : a.name.localeCompare(b.name, 'zh-Hant'));
const findBill = id => state.bills.find(b => b.id === id);
const findCard = id => state.cards.find(c => c.id === id);
const findRecipe = id => state.recipes.find(r => r.id === id);
const findTool = id => state.tools.find(t => t.id === id);

function allCategories() {
  const used = [];
  for (const c of state.cards) for (const r of c.rewards) if (!used.includes(r.cat)) used.push(r.cat);
  const rest = L.DEFAULT_CATEGORIES.filter(c => !used.includes(c));
  return [...used.filter(c => c !== L.GENERAL), ...rest.filter(c => c !== L.GENERAL), L.GENERAL];
}

function allTags() {
  const tags = [];
  for (const r of state.recipes) for (const t of r.tags) if (!tags.includes(t)) tags.push(t);
  return tags;
}

// ---------- 共用片段 ----------

const emptyLine = (text, extra = '') => `<div class="empty"><p>${esc(text)}</p>${extra}</div>`;

function billRow(b) {
  const { days, level } = L.dueStatus(b.nextDue, today());
  const card = b.cardId && findCard(b.cardId);
  const sub = [L.fmtShort(b.nextDue), L.everyLabel(b.every), money(b.amount), card ? card.name : ''].filter(Boolean).join(' · ');
  return `<div class="item lvl-${level}">
    <button type="button" class="item-main" data-act="editBill" data-id="${esc(b.id)}">
      <span class="item-title">${esc(b.name)}${b.autopay ? ' <span class="tag ok">自動扣繳</span>' : ''}</span>
      <span class="item-sub">${esc(sub)}</span>
    </button>
    <span class="badge lvl-${level}">${L.dueLabel(days)}</span>
    <button type="button" class="btn-small" data-act="payBill" data-id="${esc(b.id)}" aria-label="${esc(b.name)} 標記已繳">已繳</button>
  </div>`;
}

function catChips() {
  const cats = allCategories();
  if (!cats.includes(state.ui.cat)) state.ui.cat = cats[0];
  return `<div class="chips" role="group" aria-label="消費類別">${cats.map(c =>
    `<button type="button" class="chip ${c === state.ui.cat ? 'on' : ''}" data-act="pickCat" data-cat="${esc(c)}" aria-pressed="${c === state.ui.cat}">${esc(c)}</button>`).join('')}</div>`;
}

const cardLabel = c => `${esc(c.name)}${c.last4 ? ` <span class="muted l4">••${esc(c.last4)}</span>` : ''}`;

function payLine(pay) {
  return `今天刷，最晚 ${L.fmtShort(pay.due)} 繳（${pay.days} 天後）`;
}

function homeCardPick() {
  const list = L.recommend(state.cards, state.ui.cat, today());
  const best = list[0];
  const longest = [...list].sort((a, b) => b.pay.days - a.pay.days)[0];
  let html = '';
  if (best.rate > 0) {
    html += `<div class="pick">
      <span class="dot" style="--c:${best.card.color}"></span>
      <div class="pick-body"><div class="pick-name">${cardLabel(best.card)}</div>
      <div class="pick-sub">${best.matched ? esc(best.note || `「${state.ui.cat}」回饋`) : `沒有「${esc(state.ui.cat)}」專屬回饋，以一般消費計`}</div>
      <div class="pick-sub">${payLine(best.pay)}</div></div>
      <div class="pick-rate">${fmtRate(best.rate)}</div></div>`;
  } else {
    html += `<p class="muted">還沒有卡片設定「${esc(state.ui.cat)}」或一般消費的回饋，到信用卡頁幫卡片加上回饋。</p>`;
  }
  if (longest && longest.card !== best.card && longest.pay.days > best.pay.days) {
    html += `<p class="hint">想晚點繳：${esc(longest.card.name)} 今天刷，最晚 ${L.fmtShort(longest.pay.due)} 才繳（${longest.pay.days} 天後）</p>`;
  }
  return html;
}

function pickDish(force) {
  const t = today();
  const all = state.recipes;
  if (!all.length) return null;
  const cur = state.ui.pick;
  const tag = state.ui.dishTag;
  const pool0 = tag ? all.filter(r => r.tags.includes(tag)) : all;
  const pool1 = pool0.length ? pool0 : all;
  const current = cur && findRecipe(cur.id);
  if (!force && cur && cur.date === t && current && pool1.includes(current)) return current;
  const pool = pool1.length > 1 && current ? pool1.filter(r => r !== current) : pool1;
  const r = pool[Math.floor(Math.random() * pool.length)];
  state.ui.pick = { date: t, id: r.id };
  save();
  return r;
}

function todayDish() {
  const r = pickDish(false);
  if (!r) return emptyLine('還沒有食譜', '<button type="button" class="btn-small" data-act="newRecipe">＋ 新增食譜</button>');
  return `<div class="dish">
    <button type="button" class="dish-main" data-act="openRecipe" data-id="${esc(r.id)}">
      <span class="dish-name">${esc(r.name)}</span>
      <span class="tags">${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</span>
    </button>
    <button type="button" class="btn-small" data-act="reroll">換一道</button>
  </div>`;
}

function toolGrid(editing) {
  const items = state.tools.map((t, i) => {
    const url = safeUrl(t.url);
    const inner = `<span class="tool-icon" aria-hidden="true">${esc(t.icon || t.name.slice(0, 1))}</span><span class="tool-name">${esc(t.name)}</span>`;
    if (editing) {
      return `<div class="tool editing">
        <button type="button" class="tool-btn" data-act="editTool" data-id="${esc(t.id)}" aria-label="編輯 ${esc(t.name)}">${inner}</button>
        <div class="tool-move">
          <button type="button" class="icon-btn sm" data-act="moveTool" data-id="${esc(t.id)}" data-dir="-1" aria-label="${esc(t.name)} 往前移" ${i === 0 ? 'disabled' : ''}>‹</button>
          <button type="button" class="icon-btn sm" data-act="moveTool" data-id="${esc(t.id)}" data-dir="1" aria-label="${esc(t.name)} 往後移" ${i === state.tools.length - 1 ? 'disabled' : ''}>›</button>
        </div></div>`;
    }
    return `<a class="tool" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
  });
  items.push(`<button type="button" class="tool add" data-act="newTool"><span class="tool-icon" aria-hidden="true">＋</span><span class="tool-name">新增</span></button>`);
  return `<div class="tool-grid">${items.join('')}</div>`;
}

function backupNotice() {
  if (!state.bills.length && !state.cards.length) return '';
  const last = state.meta.lastBackupAt;
  const ref = new Date(last || state.meta.createdAt);
  const days = Math.floor((Date.now() - ref.getTime()) / 86400000);
  if (Number.isNaN(days) || days < (last ? 30 : 14)) return '';
  return `<div class="notice"><span>${last ? `已經 ${days} 天沒備份了` : '還沒有備份過資料'}，換手機或清除瀏覽器資料時會遺失。</span>
    <button type="button" class="btn-small" data-act="exportData">現在備份</button></div>`;
}

// ---------- 首頁 ----------

function viewHome() {
  const t = today();
  const due = activeBills().filter(b => L.diffDays(t, b.nextDue) <= 7).sort(byDue);
  return `${backupNotice()}
  <section class="panel">
    <div class="section-head"><h2>近期待繳</h2><button type="button" class="link" data-act="tab" data-tab="bills">全部 ›</button></div>
    ${due.length ? `<div class="list">${due.map(billRow).join('')}</div>`
      : emptyLine('未來 7 天沒有要繳的費用', state.bills.length ? '' : '<button type="button" class="btn-small" data-act="newBill">＋ 新增第一筆繳費</button>')}
  </section>
  <section class="panel">
    <div class="section-head"><h2>今天刷哪張</h2><button type="button" class="link" data-act="tab" data-tab="cards">信用卡 ›</button></div>
    ${state.cards.length ? catChips() + homeCardPick()
      : emptyLine('還沒有信用卡資料', '<button type="button" class="btn-small" data-act="newCard">＋ 新增信用卡</button>')}
  </section>
  <section class="panel">
    <div class="section-head"><h2>今天吃什麼</h2><button type="button" class="link" data-act="tab" data-tab="menu">菜單 ›</button></div>
    ${todayDish()}
  </section>
  <section class="panel">
    <div class="section-head"><h2>快捷工具</h2><button type="button" class="link" data-act="tab" data-tab="tools">管理 ›</button></div>
    ${toolGrid(false)}
  </section>`;
}

// ---------- 繳費 ----------

function viewBills() {
  const t = today();
  const act = activeBills().sort(byDue);
  const { y, m } = L.parse(t);
  const monthEnd = L.clampDate(y, m, 31);
  const thisMonth = act.filter(b => b.nextDue <= monthEnd);
  const total = thisMonth.reduce((s, b) => s + (hasAmount(b.amount) ? Number(b.amount) : 0), 0);
  const noAmount = thisMonth.filter(b => !hasAmount(b.amount)).length;
  const done = state.bills.filter(b => b.doneAt).sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1));
  const groups = [
    ['已過期', b => L.diffDays(t, b.nextDue) < 0],
    ['7 天內', b => { const d = L.diffDays(t, b.nextDue); return d >= 0 && d <= 7; }],
    ['之後', b => L.diffDays(t, b.nextDue) > 7],
  ];
  return `<div class="page-head"><h1>繳費</h1><button type="button" class="primary" data-act="newBill">＋ 新增</button></div>
  <section class="panel">
    <div class="stats">
      <div class="stat"><span class="stat-label">${m} 月底前還要繳</span><span class="stat-value">${money(total) || 'NT$0'}</span></div>
      <div class="stat"><span class="stat-label">筆數</span><span class="stat-value">${thisMonth.length}</span></div>
    </div>
    ${noAmount ? `<p class="hint">其中 ${noAmount} 筆沒填金額，沒有算進去</p>` : ''}
  </section>
  <section class="panel">
    <h2 class="sub">快速新增</h2>
    <div class="chips">${L.BILL_PRESETS.map((p, i) => `<button type="button" class="chip" data-act="presetBill" data-i="${i}">${esc(p.name)}</button>`).join('')}</div>
  </section>
  ${act.length ? groups.map(([title, fn]) => {
    const items = act.filter(fn);
    return items.length ? `<section class="panel"><h2 class="sub">${title}</h2><div class="list">${items.map(billRow).join('')}</div></section>` : '';
  }).join('') : `<section class="panel">${emptyLine('還沒有繳費項目，點上面的「快速新增」或「＋ 新增」開始')}</section>`}
  ${act.length ? `<section class="panel calendar-box">
    <h2 class="sub">加入手機行事曆</h2>
    <p class="hint">App 關著的時候沒辦法跳通知，交給手機行事曆提醒最可靠。每筆會照週期重複，並在你設定的天數前早上 9 點提醒。</p>
    <button type="button" data-act="icsAll">下載全部（${act.length} 筆）行事曆檔</button>
    <p class="hint">Android：Google 日曆 App 不能直接開 .ics，請在每筆繳費裡按「Google 日曆」，或用電腦到 Google 日曆網頁「設定 → 匯入」。</p>
  </section>` : ''}
  ${done.length ? `<details class="panel"><summary>已完成的單次項目（${done.length}）</summary><div class="list">${done.map(b => `<div class="item">
      <div class="item-main static"><span class="item-title">${esc(b.name)}</span><span class="item-sub">${L.fmtShort(b.doneAt)} 完成${hasAmount(b.amount) ? ` · ${money(b.amount)}` : ''}</span></div>
      <button type="button" class="btn-small" data-act="deleteBill" data-id="${esc(b.id)}">刪除</button></div>`).join('')}</div></details>` : ''}`;
}

function billForm(bill, preset) {
  const isNew = !bill;
  const t = today();
  const b = bill || {
    name: preset ? preset.name : '',
    amount: '',
    nextDue: preset && preset.month ? L.nextYearlyOnOrAfter(t, preset.month, preset.day) : '',
    every: preset ? preset.every : 1,
    autopay: false,
    cardId: '',
    remindDays: 3,
    note: preset && preset.note ? preset.note : '',
  };
  const linked = bill && bill.cardBillOf && findCard(bill.cardBillOf);
  const remindOpts = [0, 1, 2, 3, 5, 7, 14];
  if (!remindOpts.includes(b.remindDays)) remindOpts.push(b.remindDays);
  const body = `
    ${linked ? `<p class="hint box">這筆是信用卡「${esc(linked.name)}」自動建立的卡費提醒，改卡片的繳款日會一起更新。</p>` : ''}
    <label class="field"><span>名稱</span><input name="name" required maxlength="40" value="${esc(b.name)}" list="bill-names" placeholder="中華電信" data-msg="請填名稱" autocomplete="off"></label>
    <datalist id="bill-names">${L.BILL_PRESETS.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist>
    <div class="grid2">
      <label class="field"><span>下次繳費日</span><input type="date" name="nextDue" required value="${esc(b.nextDue)}" data-msg="請選下次繳費日"></label>
      <label class="field"><span>多久一次</span><select name="every">${L.EVERY_OPTIONS.map(([v, l]) => `<option value="${v}" ${v === b.every ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="grid2">
      <label class="field"><span>金額（可不填）</span><input name="amount" type="number" inputmode="numeric" min="0" step="1" value="${esc(b.amount)}" placeholder="599" data-msg="金額要是 0 以上的整數"></label>
      <label class="field"><span>行事曆提醒</span><select name="remindDays">${remindOpts.map(d => `<option value="${d}" ${d === b.remindDays ? 'selected' : ''}>${d === 0 ? '當天早上' : `${d} 天前`}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>付款方式</span><select name="cardId"><option value="">不指定</option>${state.cards.map(c => `<option value="${esc(c.id)}" ${c.id === b.cardId ? 'selected' : ''}>${esc(c.name)}${c.last4 ? ` ••${esc(c.last4)}` : ''}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" name="autopay" ${b.autopay ? 'checked' : ''}><span>自動扣繳（過了日期會自動跳到下一期）</span></label>
    <label class="field"><span>備註</span><textarea name="note" rows="2" maxlength="300" placeholder="繳費方式、電號、注意事項">${esc(b.note)}</textarea></label>
    ${isNew ? '' : `<div class="cal-row"><span>加入行事曆</span><button type="button" class="btn-small" data-act="icsOne" data-id="${esc(bill.id)}">下載 .ics</button><a class="button btn-small" href="${esc(L.googleCalendarUrl(bill))}" target="_blank" rel="noopener noreferrer">Google 日曆</a></div>`}`;
  const foot = `${isNew ? '' : `<button type="button" class="danger ghost" data-act="deleteBill" data-id="${esc(bill.id)}">刪除</button>`}<span class="spacer"></span><button type="submit" class="primary">儲存</button>`;
  openSheet({
    title: isNew ? (preset ? `新增「${preset.name}」` : '新增繳費') : '編輯繳費',
    body, foot,
    onSubmit: fd => {
      const name = String(fd.get('name')).trim();
      if (!name) return '請填名稱';
      const nextDue = String(fd.get('nextDue'));
      if (!L.isValidDate(nextDue)) return '請選正確的日期';
      const amountRaw = String(fd.get('amount')).trim();
      if (amountRaw && !(Number(amountRaw) >= 0)) return '金額要是 0 以上的數字';
      const note = String(fd.get('note')).trim();
      if (L.looksLikeCardNumber(note)) return '備註裡看起來有完整卡號，為了安全請不要存';
      const data = {
        name, nextDue, note,
        every: Number(fd.get('every')),
        amount: amountRaw ? Math.round(Number(amountRaw)) : '',
        remindDays: Number(fd.get('remindDays')),
        cardId: String(fd.get('cardId')),
        autopay: fd.get('autopay') === 'on',
      };
      data.anchorDay = bill && bill.nextDue === nextDue && bill.anchorDay ? bill.anchorDay : L.parse(nextDue).d;
      if (bill) Object.assign(bill, data, data.every ? { doneAt: '' } : {});
      else state.bills.push(normBill({ id: uid(), ...data }));
      rollAll();
      save();
      render();
      toast(isNew ? `已新增「${name}」` : '已儲存');
    },
  });
}

function payBill(id) {
  const b = findBill(id);
  if (!b) return;
  const prev = { nextDue: b.nextDue, doneAt: b.doneAt, lastPaidAt: b.lastPaidAt };
  Object.assign(b, L.payBill(b, today()));
  save();
  render();
  toast(b.doneAt ? `「${b.name}」已完成` : `「${b.name}」已繳，下次 ${L.fmtShort(b.nextDue)}`, '復原', () => {
    Object.assign(b, prev);
    save();
    render();
  });
}

function deleteBill(id) {
  const b = findBill(id);
  if (!b) return;
  if (!confirm(`刪除「${b.name}」？`)) return;
  const idx = state.bills.indexOf(b);
  state.bills.splice(idx, 1);
  const card = b.cardBillOf && findCard(b.cardBillOf);
  if (card) card.remind = false;
  closeSheet();
  save();
  render();
  toast(`已刪除「${b.name}」`, '復原', () => {
    state.bills.splice(idx, 0, b);
    if (card) card.remind = true;
    save();
    render();
  });
}

function describeBill(b) {
  const card = b.cardId && findCard(b.cardId);
  return [b.autopay ? '自動扣繳' : '', card ? `付款：${card.name}${card.last4 ? ` ••${card.last4}` : ''}` : '', b.note].filter(Boolean).join('\n');
}

// ---------- 信用卡 ----------

function rankRow(x) {
  return `<li class="rank-row">
    <span class="dot" style="--c:${x.card.color}"></span>
    <div class="rank-body"><div class="rank-name">${cardLabel(x.card)}</div>
    <div class="rank-sub">${x.matched ? esc(x.note || '專屬回饋') : (x.rate ? '以一般消費計' : '沒有設定回饋')} · ${payLine(x.pay)}</div></div>
    <span class="rank-rate ${x.matched ? 'hit' : ''}">${fmtRate(x.rate)}</span></li>`;
}

function cardTile(c) {
  const pay = L.payInfo(c, today());
  const dueText = c.dueDay > c.statementDay ? `當月 ${c.dueDay} 日` : `次月 ${c.dueDay} 日`;
  return `<button type="button" class="ccard" data-act="editCard" data-id="${esc(c.id)}" style="--c:${c.color}">
    <span class="ccard-top"><span class="ccard-name">${esc(c.name)}</span><span class="ccard-num">${c.last4 ? `•••• ${esc(c.last4)}` : ''}</span></span>
    <span class="ccard-dates">結帳 每月 ${c.statementDay} 日 · 繳款 ${dueText}${c.autopay ? ' · 自動扣繳' : ''}</span>
    ${c.rewards.length ? `<span class="ccard-chips">${c.rewards.map(r => `<span class="ccard-chip">${esc(r.cat)} ${fmtRate(r.rate)}</span>`).join('')}</span>` : ''}
    ${c.fee ? `<span class="ccard-fee">年費：${esc(c.fee)}</span>` : ''}
    <span class="ccard-float">${payLine(pay)}</span>
  </button>`;
}

function viewCards() {
  const has = state.cards.length > 0;
  const list = has ? L.recommend(state.cards, state.ui.cat, today()) : [];
  return `<div class="page-head"><h1>信用卡</h1><button type="button" class="primary" data-act="newCard">＋ 新增</button></div>
  ${has ? `<section class="panel"><h2 class="sub">這筆刷哪張？</h2>${catChips()}<ol class="rank">${list.map(rankRow).join('')}</ol></section>` : ''}
  ${has ? `<div class="card-list">${state.cards.map(cardTile).join('')}</div>`
    : `<section class="panel">${emptyLine('還沒有信用卡', '<button type="button" class="btn-small" data-act="newCard">＋ 新增第一張卡</button>')}<p class="hint">建議填：卡片名稱、末四碼、結帳日、繳款日，以及各類別的回饋 %。</p></section>`}
  <p class="lock-note">🔒 只存末四碼。完整卡號、到期日、CVV、網銀密碼一律不要存。</p>`;
}

function rewardRow(r) {
  return `<div class="reward-row">
    <input name="r_cat" list="cat-list" value="${esc(r.cat)}" placeholder="類別" aria-label="回饋類別" maxlength="12" autocomplete="off">
    <span class="rate-wrap"><input name="r_rate" type="number" inputmode="decimal" step="0.01" min="0" max="100" value="${esc(r.rate)}" aria-label="回饋百分比" placeholder="0"><span>%</span></span>
    <input name="r_note" value="${esc(r.note)}" placeholder="上限、條件（可不填）" aria-label="回饋說明" maxlength="60" autocomplete="off">
    <button type="button" class="icon-btn sm" data-act="delReward" aria-label="刪除這列回饋">✕</button>
  </div>`;
}

function cardForm(card) {
  const isNew = !card;
  const c = card || {
    name: '', last4: '', color: CARD_COLORS[state.cards.length % CARD_COLORS.length], statementDay: '', dueDay: '',
    autopay: false, remind: true, rewards: [{ cat: L.GENERAL, rate: 1, note: '' }], fee: '', note: '',
  };
  const dayOpts = sel => Array.from({ length: 31 }, (_, i) => i + 1).map(d => `<option value="${d}" ${d === sel ? 'selected' : ''}>${d} 日</option>`).join('');
  const body = `
    <p class="hint box">🔒 只填末四碼就好。完整卡號、到期日、CVV、網銀密碼一律不要存在這裡。</p>
    <div class="grid2 wide-first">
      <label class="field"><span>卡片名稱</span><input name="name" required maxlength="30" value="${esc(c.name)}" placeholder="國泰 CUBE 卡" data-msg="請填卡片名稱" autocomplete="off"></label>
      <label class="field"><span>末四碼</span><input name="last4" inputmode="numeric" pattern="\\d{4}" maxlength="4" value="${esc(c.last4)}" placeholder="1234" data-msg="末四碼要是 4 位數字" autocomplete="off"></label>
    </div>
    <fieldset class="field"><legend>顏色</legend><div class="swatches">${CARD_COLORS.map((col, i) =>
      `<label class="swatch" style="--c:${col}"><input type="radio" name="color" value="${col}" ${col === c.color ? 'checked' : ''} aria-label="顏色 ${i + 1}"><span></span></label>`).join('')}</div></fieldset>
    <div class="grid2">
      <label class="field"><span>結帳日</span><select name="statementDay" required data-msg="請選結帳日"><option value="">選擇</option>${dayOpts(c.statementDay)}</select></label>
      <label class="field"><span>繳款截止日</span><select name="dueDay" required data-msg="請選繳款截止日"><option value="">選擇</option>${dayOpts(c.dueDay)}</select></label>
    </div>
    <label class="check"><input type="checkbox" name="autopay" ${c.autopay ? 'checked' : ''}><span>卡費設定了自動扣繳</span></label>
    <label class="check"><input type="checkbox" name="remind" ${c.remind ? 'checked' : ''}><span>在「繳費」清單提醒我繳這張卡的卡費</span></label>
    <fieldset class="field"><legend>回饋（依消費類別）</legend>
      <div id="reward-rows">${c.rewards.map(rewardRow).join('')}</div>
      <button type="button" class="btn-small" data-act="addReward">＋ 新增一列</button>
      <datalist id="cat-list">${allCategories().map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <p class="hint">「一般消費」是沒有專屬回饋時的基本回饋。類別名稱一樣，才會被拿來比較。</p>
    </fieldset>
    <label class="field"><span>年費／免年費條件</span><input name="fee" maxlength="60" value="${esc(c.fee)}" placeholder="首年免年費，年刷 6 筆免次年" autocomplete="off"></label>
    <label class="field"><span>備註</span><textarea name="note" rows="2" maxlength="300" placeholder="活動期限、回饋上限、要綁定的支付">${esc(c.note)}</textarea></label>`;
  const foot = `${isNew ? '' : `<button type="button" class="danger ghost" data-act="deleteCard" data-id="${esc(card.id)}">刪除</button>`}<span class="spacer"></span><button type="submit" class="primary">儲存</button>`;
  openSheet({
    title: isNew ? '新增信用卡' : '編輯信用卡',
    body, foot,
    onSubmit: fd => {
      const name = String(fd.get('name')).trim();
      const last4 = String(fd.get('last4')).trim();
      if (!name) return '請填卡片名稱';
      if (last4 && !/^\d{4}$/.test(last4)) return '末四碼要是 4 位數字';
      const statementDay = Number(fd.get('statementDay'));
      const dueDay = Number(fd.get('dueDay'));
      if (!statementDay || !dueDay) return '請選結帳日和繳款截止日';
      const cats = fd.getAll('r_cat').map(s => String(s).trim());
      const rates = fd.getAll('r_rate');
      const notes = fd.getAll('r_note').map(s => String(s).trim());
      const rewards = [];
      for (let i = 0; i < cats.length; i++) {
        if (!cats[i]) continue;
        const rate = Number(rates[i]);
        if (!(rate >= 0 && rate <= 100)) return `「${cats[i]}」的回饋 % 要是 0–100 的數字`;
        rewards.push({ cat: cats[i], rate, note: notes[i] });
      }
      const fee = String(fd.get('fee')).trim();
      const note = String(fd.get('note')).trim();
      if ([name, fee, note, ...notes].some(L.looksLikeCardNumber)) return '看起來有輸入完整卡號，為了安全請只填末四碼';
      const data = normCard({
        id: card ? card.id : uid(), name, last4, statementDay, dueDay, rewards, fee, note,
        color: String(fd.get('color') || c.color), autopay: fd.get('autopay') === 'on', remind: fd.get('remind') === 'on',
      });
      if (card) Object.assign(card, data);
      else state.cards.push(data);
      syncCardBill(card || data);
      save();
      render();
      toast(isNew ? `已新增「${name}」` : '已儲存');
    },
  });
}

// 卡片勾選「提醒繳卡費」時，自動在繳費清單維護一筆每月的卡費。
function syncCardBill(card) {
  const t = today();
  const b = state.bills.find(x => x.cardBillOf === card.id);
  if (card.remind) {
    const name = `${card.name} 卡費`;
    if (!b) {
      state.bills.push(normBill({
        id: uid(), name, every: 1, anchorDay: card.dueDay, nextDue: L.nextMonthlyOnOrAfter(t, card.dueDay),
        autopay: card.autopay, cardBillOf: card.id, remindDays: 3,
      }));
    } else {
      b.name = name;
      b.autopay = card.autopay;
      if (b.anchorDay !== card.dueDay) {
        const { y, m } = L.parse(b.nextDue);
        let next = L.clampDate(y, m, card.dueDay);
        if (next < t && b.nextDue >= t) next = L.nextMonthlyOnOrAfter(t, card.dueDay);
        b.anchorDay = card.dueDay;
        b.nextDue = next;
      }
    }
  } else if (b) {
    state.bills.splice(state.bills.indexOf(b), 1);
  }
  rollAll();
}

function deleteCard(id) {
  const c = findCard(id);
  if (!c) return;
  if (!confirm(`刪除「${c.name}」？這張卡的卡費提醒也會一起刪除。`)) return;
  const snapshot = JSON.stringify({ cards: state.cards, bills: state.bills });
  state.cards = state.cards.filter(x => x !== c);
  state.bills = state.bills.filter(b => b.cardBillOf !== c.id);
  for (const b of state.bills) if (b.cardId === c.id) b.cardId = '';
  closeSheet();
  save();
  render();
  toast(`已刪除「${c.name}」`, '復原', () => {
    const s = JSON.parse(snapshot);
    state.cards = s.cards;
    state.bills = s.bills;
    save();
    render();
  });
}

// ---------- 菜單 ----------

let recipeQuery = '';

function recipeListHTML() {
  const q = recipeQuery.trim().toLowerCase();
  const list = state.recipes.filter(r => !q || [r.name, r.tags.join(' '), r.ingredients].join(' ').toLowerCase().includes(q));
  if (!state.recipes.length) return emptyLine('還沒有食譜', '<button type="button" class="btn-small" data-act="newRecipe">＋ 新增食譜</button>');
  if (!list.length) return emptyLine(`找不到「${recipeQuery}」`);
  return list.map(r => {
    const inPlan = state.plan.includes(r.id);
    const count = String(r.ingredients).split(/\r?\n/).filter(s => s.trim()).length;
    const sub = [r.tags.join('、'), count ? `${count} 種食材` : ''].filter(Boolean).join(' · ');
    return `<div class="item">
      <button type="button" class="item-main" data-act="openRecipe" data-id="${esc(r.id)}"><span class="item-title">${esc(r.name)}</span><span class="item-sub">${esc(sub)}</span></button>
      <button type="button" class="btn-small ${inPlan ? 'on' : ''}" data-act="togglePlan" data-id="${esc(r.id)}" aria-pressed="${inPlan}">${inPlan ? '✓ 本週' : '＋ 本週'}</button>
    </div>`;
  }).join('');
}

function menuRecipes() {
  return `<section class="panel">
    <input type="search" id="recipe-q" placeholder="搜尋菜名、食材或標籤" aria-label="搜尋食譜" value="${esc(recipeQuery)}" autocomplete="off">
    <div class="list" id="recipe-list">${recipeListHTML()}</div>
  </section>`;
}

const planRecipes = () => state.plan.map(findRecipe).filter(Boolean);

function menuPlan() {
  const items = planRecipes();
  if (!items.length) {
    return `<section class="panel">${emptyLine('本週還沒排菜', '<button type="button" class="btn-small" data-act="menuTab" data-k="recipes">去食譜挑幾道</button>')}</section>`;
  }
  return `<section class="panel"><div class="list">${items.map(r => `<div class="item">
      <button type="button" class="item-main" data-act="openRecipe" data-id="${esc(r.id)}"><span class="item-title">${esc(r.name)}</span><span class="item-sub">${esc(r.tags.join('、'))}</span></button>
      <button type="button" class="btn-small" data-act="togglePlan" data-id="${esc(r.id)}">移除</button></div>`).join('')}</div>
    <div class="row-actions"><button type="button" class="primary" data-act="menuTab" data-k="shop">看買菜清單</button><button type="button" data-act="clearPlan">清空本週</button></div>
  </section>`;
}

function menuShop() {
  const recipes = planRecipes();
  const list = L.shoppingList(recipes);
  const checked = state.shopping.checked;
  const extra = state.shopping.extra;
  return `<section class="panel">
    <h2 class="sub">本週菜單需要（${recipes.length} 道菜）</h2>
    ${list.length ? `<ul class="checklist">${list.map(it => `<li><label class="${checked[it.name] ? 'done' : ''}">
        <input type="checkbox" data-act="checkItem" data-key="${esc(it.name)}" ${checked[it.name] ? 'checked' : ''}>
        <span class="ck-text"><span class="ck-name">${esc(it.name)}</span> <span class="ck-qty">${esc(L.mergeQty(it.qtys))}</span><span class="ck-from">${esc(it.from.join('、'))}</span></span>
      </label></li>`).join('')}</ul>`
      : `<p class="muted">先到「本週要煮」加幾道菜，食材會自動列在這裡。</p>`}
    <h2 class="sub">其他要買</h2>
    ${extra.length ? `<ul class="checklist">${extra.map(x => `<li><label class="${x.done ? 'done' : ''}">
        <input type="checkbox" data-act="checkExtra" data-id="${esc(x.id)}" ${x.done ? 'checked' : ''}><span class="ck-text"><span class="ck-name">${esc(x.text)}</span></span></label>
        <button type="button" class="icon-btn sm" data-act="delExtra" data-id="${esc(x.id)}" aria-label="刪除 ${esc(x.text)}">✕</button></li>`).join('')}</ul>` : ''}
    <div class="add-row"><input id="extra-input" placeholder="衛生紙" aria-label="新增其他要買的東西" maxlength="40" enterkeyhint="done" autocomplete="off"><button type="button" data-act="addExtra">加入</button></div>
    <div class="row-actions"><button type="button" data-act="copyShop">複製清單</button><button type="button" data-act="clearChecked">清空勾選</button></div>
  </section>`;
}

function viewMenu() {
  const tab = state.ui.menuTab;
  const tags = allTags();
  const seg = [['recipes', `食譜 ${state.recipes.length}`], ['plan', `本週要煮 ${state.plan.length}`], ['shop', '買菜清單']];
  return `<div class="page-head"><h1>菜單</h1><button type="button" class="primary" data-act="newRecipe">＋ 食譜</button></div>
  <section class="panel">
    <div class="section-head"><h2>今天吃什麼</h2></div>
    ${tags.length ? `<div class="chips" role="group" aria-label="只從這個標籤抽">${['', ...tags].map(t =>
      `<button type="button" class="chip ${t === state.ui.dishTag ? 'on' : ''}" data-act="dishTag" data-tag="${esc(t)}" aria-pressed="${t === state.ui.dishTag}">${t ? esc(t) : '全部'}</button>`).join('')}</div>` : ''}
    ${todayDish()}
  </section>
  <div class="seg" role="tablist" aria-label="菜單分類">${seg.map(([k, label]) =>
    `<button type="button" role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-act="menuTab" data-k="${k}">${label}</button>`).join('')}</div>
  ${tab === 'plan' ? menuPlan() : tab === 'shop' ? menuShop() : menuRecipes()}`;
}

function openRecipe(id) {
  const r = findRecipe(id);
  if (!r) return;
  const inPlan = state.plan.includes(r.id);
  const ings = String(r.ingredients).split(/\r?\n/).map(L.parseIngredient).filter(Boolean);
  const url = safeUrl(r.link);
  const body = `
    ${r.tags.length ? `<div class="tags">${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    <h3>食材</h3>
    ${ings.length ? `<ul class="ing">${ings.map(i => `<li><span>${esc(i.name)}</span><span class="muted">${esc(i.qty)}</span></li>`).join('')}</ul>` : '<p class="muted">沒有填食材</p>'}
    <h3>步驟</h3>
    ${r.steps ? `<div class="steps">${esc(r.steps)}</div>` : '<p class="muted">沒有填步驟</p>'}
    ${url ? `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">開啟參考連結 ↗</a></p>` : ''}
    ${r.note ? `<h3>備註</h3><div class="steps">${esc(r.note)}</div>` : ''}`;
  const foot = `<button type="button" class="danger ghost" data-act="deleteRecipe" data-id="${esc(r.id)}">刪除</button><span class="spacer"></span>
    <button type="button" data-act="editRecipe" data-id="${esc(r.id)}">編輯</button>
    <button type="button" class="primary" data-act="togglePlan" data-id="${esc(r.id)}" data-from="sheet">${inPlan ? '移出本週' : '加入本週'}</button>`;
  openSheet({ title: r.name, body, foot });
}

function recipeForm(recipe) {
  const isNew = !recipe;
  const r = recipe || { name: '', tags: [], ingredients: '', steps: '', link: '', note: '' };
  const body = `
    <label class="field"><span>菜名</span><input name="name" required maxlength="40" value="${esc(r.name)}" placeholder="麻婆豆腐" data-msg="請填菜名" autocomplete="off"></label>
    <label class="field"><span>標籤（用逗號或空白分開）</span><input name="tags" value="${esc(r.tags.join('、'))}" placeholder="下飯、豆腐、快速" list="tag-list" autocomplete="off"></label>
    <datalist id="tag-list">${allTags().map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <label class="field"><span>食材（一行一種，名稱和份量用空白分開）</span><textarea name="ingredients" rows="5" maxlength="2000" placeholder="豆腐 1盒&#10;絞肉 150g&#10;蔥 2支">${esc(r.ingredients)}</textarea></label>
    <label class="field"><span>步驟</span><textarea name="steps" rows="5" maxlength="5000" placeholder="1. 豆腐切丁汆燙&#10;2. 爆香絞肉…">${esc(r.steps)}</textarea></label>
    <label class="field"><span>參考連結（YouTube、食譜網站）</span><input name="link" type="text" inputmode="url" autocapitalize="off" spellcheck="false" value="${esc(r.link)}" placeholder="https://" autocomplete="off"></label>
    <label class="field"><span>備註</span><textarea name="note" rows="2" maxlength="500">${esc(r.note)}</textarea></label>`;
  const foot = `<span class="spacer"></span><button type="submit" class="primary">儲存</button>`;
  openSheet({
    title: isNew ? '新增食譜' : '編輯食譜',
    body, foot,
    onSubmit: fd => {
      const name = String(fd.get('name')).trim();
      if (!name) return '請填菜名';
      const linkRaw = String(fd.get('link')).trim();
      const link = linkRaw ? safeUrl(/^https?:\/\//i.test(linkRaw) ? linkRaw : `https://${linkRaw}`) : '';
      if (linkRaw && !link) return '參考連結的網址格式不對';
      const data = normRecipe({
        id: recipe ? recipe.id : uid(), name, link,
        tags: L.parseTags(fd.get('tags')),
        ingredients: String(fd.get('ingredients')).trim(),
        steps: String(fd.get('steps')).trim(),
        note: String(fd.get('note')).trim(),
      });
      if (recipe) Object.assign(recipe, data);
      else state.recipes.push(data);
      save();
      render();
      toast(isNew ? `已新增「${name}」` : '已儲存');
    },
  });
}

function deleteRecipe(id) {
  const r = findRecipe(id);
  if (!r || !confirm(`刪除食譜「${r.name}」？`)) return;
  const idx = state.recipes.indexOf(r);
  const planIdx = state.plan.indexOf(r.id);
  state.recipes.splice(idx, 1);
  if (planIdx >= 0) state.plan.splice(planIdx, 1);
  closeSheet();
  save();
  render();
  toast(`已刪除「${r.name}」`, '復原', () => {
    state.recipes.splice(idx, 0, r);
    if (planIdx >= 0) state.plan.splice(planIdx, 0, r.id);
    save();
    render();
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// ---------- 工具與備份 ----------

let installPrompt = null;

function viewTools() {
  const editing = !!state.ui.editTools;
  const last = state.meta.lastBackupAt;
  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
  const backupText = last ? `上次備份：${days === 0 ? '今天' : `${days} 天前`}` : '還沒有備份過';
  return `<div class="page-head"><h1>工具</h1><button type="button" data-act="toggleEditTools" aria-pressed="${editing}">${editing ? '完成' : '編輯'}</button></div>
  <section class="panel">${toolGrid(editing)}${editing ? '<p class="hint">點圖示修改或刪除，用 ‹ › 調整順序。</p>' : ''}</section>
  <section class="panel">
    <h2 class="sub">資料與備份</h2>
    <p class="hint">所有資料只存在這台裝置的瀏覽器裡，不會上傳。換手機或清除瀏覽器資料前，記得先匯出備份。</p>
    <p class="backup-status ${!last || days > 30 ? 'warn' : ''}">${backupText}</p>
    <div class="row-actions"><button type="button" class="primary" data-act="exportData">匯出備份</button>
      <label class="button">匯入備份<input type="file" id="import-file" accept="application/json,.json" hidden></label></div>
    <p class="hint" id="persist-status"></p>
  </section>
  <section class="panel">
    <h2 class="sub">加到手機主畫面</h2>
    ${installPrompt ? '<button type="button" class="primary" data-act="install">安裝到這台裝置</button>' : ''}
    <ul class="howto">
      <li><b>iPhone</b>：用 Safari 開啟 → 下方「分享」→「加入主畫面」</li>
      <li><b>Android</b>：用 Chrome 開啟 → 右上選單 →「安裝應用程式」或「加到主畫面」</li>
    </ul>
    <p class="hint">iPhone 要注意：主畫面 App 和 Safari 分頁的資料是分開存的，請加到主畫面後再開始輸入。已經在 Safari 輸入的，可以先匯出備份，再到主畫面 App 匯入。</p>
  </section>
  <section class="panel danger-zone">
    <h2 class="sub">清除所有資料</h2>
    <p class="hint">會刪掉這台裝置上的繳費、信用卡、食譜和工具，無法復原。</p>
    <button type="button" class="danger" data-act="wipe">清除所有資料</button>
  </section>
  <p class="version">生活助理 v${APP_VERSION}</p>`;
}

function toolForm(tool) {
  const isNew = !tool;
  const t = tool || { name: '', url: '', icon: '' };
  const body = `
    <div class="grid2 wide-first">
      <label class="field"><span>名稱</span><input name="name" required maxlength="12" value="${esc(t.name)}" placeholder="運費計算" data-msg="請填名稱" autocomplete="off"></label>
      <label class="field"><span>圖示</span><input name="icon" maxlength="4" value="${esc(t.icon)}" placeholder="🔗" autocomplete="off"></label>
    </div>
    <div class="icon-picks" role="group" aria-label="常用圖示">${TOOL_ICONS.map(i => `<button type="button" class="icon-pick ${i === t.icon ? 'on' : ''}" data-act="pickIcon" data-icon="${i}" aria-label="使用圖示 ${i}">${i}</button>`).join('')}</div>
    <label class="field"><span>網址</span><input name="url" required type="text" inputmode="url" autocapitalize="off" spellcheck="false" value="${esc(t.url)}" placeholder="https://color.bidezato.com/" data-msg="請填網址" autocomplete="off"></label>`;
  const foot = `${isNew ? '' : `<button type="button" class="danger ghost" data-act="deleteTool" data-id="${esc(tool.id)}">刪除</button>`}<span class="spacer"></span><button type="submit" class="primary">儲存</button>`;
  openSheet({
    title: isNew ? '新增工具' : '編輯工具',
    body, foot,
    onSubmit: fd => {
      const name = String(fd.get('name')).trim();
      const raw = String(fd.get('url')).trim();
      if (!name) return '請填名稱';
      const url = safeUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!raw || !url) return '網址格式不對，要以 https:// 開頭';
      const data = normTool({ id: tool ? tool.id : uid(), name, url, icon: String(fd.get('icon')).trim() });
      if (tool) Object.assign(tool, data);
      else state.tools.push(data);
      save();
      render();
      toast(isNew ? `已新增「${name}」` : '已儲存');
    },
  });
}

function deleteTool(id) {
  const t = findTool(id);
  if (!t || !confirm(`刪除「${t.name}」？`)) return;
  const idx = state.tools.indexOf(t);
  state.tools.splice(idx, 1);
  closeSheet();
  save();
  render();
  toast(`已刪除「${t.name}」`, '復原', () => { state.tools.splice(idx, 0, t); save(); render(); });
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function exportData() {
  const payload = { app: 'life-assistant', version: 1, exportedAt: new Date().toISOString(), data: state };
  const text = JSON.stringify(payload, null, 2);
  const filename = `生活助理備份-${today().replace(/-/g, '')}.json`;
  const markDone = msg => { state.meta.lastBackupAt = new Date().toISOString(); save(); render(); toast(msg); };
  // 手機上用分享選單，可以直接存到「檔案」、雲端硬碟或傳到 LINE。
  if (isMobile() && navigator.canShare) {
    const file = new File([text], filename, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '生活助理備份' });
        markDone('備份已分享，記得存在找得到的地方');
      } catch (e) {
        if (e && e.name !== 'AbortError') toast('分享失敗，改用下載');
        else return;
        downloadBlob(new Blob([text], { type: 'application/json' }), filename);
        markDone('備份檔已下載');
      }
      return;
    }
  }
  downloadBlob(new Blob([text], { type: 'application/json' }), filename);
  markDone('備份檔已下載，建議存到雲端硬碟');
}

async function importFile(file) {
  let json;
  try {
    json = JSON.parse(await file.text());
  } catch {
    toast('匯入失敗：這不是正確的備份檔');
    return;
  }
  if (!json || json.app !== 'life-assistant' || !json.data || typeof json.data !== 'object') {
    toast('匯入失敗：這不是生活助理的備份檔');
    return;
  }
  const next = migrate(json.data);
  const summary = `繳費 ${next.bills.length} 筆、信用卡 ${next.cards.length} 張、食譜 ${next.recipes.length} 道、工具 ${next.tools.length} 個`;
  if (!confirm(`要用這個備份取代目前所有資料嗎？\n\n備份內容：${summary}\n\n目前這台裝置上的資料會被覆蓋。`)) return;
  const prev = state;
  state = next;
  state.ui.tab = 'tools';
  rollAll();
  save();
  render();
  toast('已匯入備份', '復原', () => { state = prev; save(); render(); });
}

function downloadICS(bills, filename) {
  if (!bills.length) return;
  const ics = L.buildICS(bills, { describe: describeBill });
  if (isIOS()) {
    // iPhone 的 Safari 開啟行事曆格式會直接跳出「加入行事曆」。
    const url = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    if (navigator.standalone) window.open(url, '_blank');
    else location.href = url;
    return;
  }
  downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), filename);
  toast('已下載行事曆檔，打開它就能加入行事曆');
}

// ---------- 底部抽屜（表單） ----------

const sheet = $('#sheet');
let sheetSubmit = null;

function setError(msg) {
  const el = $('#sheet-error');
  el.textContent = msg;
  el.hidden = !msg;
}

function openSheet({ title, body, foot = '', onSubmit = null }) {
  $('#sheet-title').textContent = title;
  $('#sheet-body').innerHTML = body;
  $('#sheet-foot').innerHTML = foot;
  setError('');
  sheetSubmit = onSubmit;
  if (!sheet.open) sheet.showModal();
  $('#sheet-body').scrollTop = 0;
}

function closeSheet() {
  if (sheet.open) sheet.close();
  sheetSubmit = null;
}

$('#sheet-form').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.checkValidity()) {
    const bad = form.querySelector(':invalid');
    setError((bad && bad.dataset.msg) || '有欄位還沒填好');
    if (bad) bad.focus();
    return;
  }
  if (!sheetSubmit) { closeSheet(); return; }
  const res = sheetSubmit(new FormData(form), form);
  if (typeof res === 'string') { setError(res); return; }
  closeSheet();
});

sheet.addEventListener('input', () => { if (!$('#sheet-error').hidden) setError(''); });
sheet.addEventListener('close', () => { sheetSubmit = null; });

// ---------- 提示訊息 ----------

let toastTimer = null;

function hideToast() {
  const el = $('#toast');
  el.classList.remove('show');
  el.hidden = true;
}

function toast(text, actionLabel, onAction) {
  const el = $('#toast');
  const btn = $('#toast-action');
  $('#toast-text').textContent = text;
  if (actionLabel) {
    btn.textContent = actionLabel;
    btn.hidden = false;
    btn.onclick = () => { hideToast(); onAction(); };
  } else {
    btn.hidden = true;
    btn.onclick = null;
  }
  el.hidden = false;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 3000);
}

// ---------- 畫面切換 ----------

const VIEWS = { home: viewHome, bills: viewBills, cards: viewCards, menu: viewMenu, tools: viewTools };
const view = $('#view');
let renderedDay = '';

function render() {
  const tab = VIEWS[state.ui.tab] ? state.ui.tab : 'home';
  renderedDay = today();
  $('#today').textContent = L.fmtShort(renderedDay);
  for (const b of $$('.tabbar button')) {
    const on = b.dataset.tab === tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  view.innerHTML = VIEWS[tab]();
  if (tab === 'tools') showPersistStatus();
}

function go(tab) {
  state.ui.tab = tab;
  if (tab !== 'tools') state.ui.editTools = false;
  save();
  render();
  window.scrollTo(0, 0);
}

async function showPersistStatus() {
  const el = $('#persist-status');
  if (!el || !navigator.storage || !navigator.storage.persisted) return;
  try {
    const p = await navigator.storage.persisted();
    el.textContent = p ? '這台裝置已允許長期保存資料。' : '瀏覽器在空間不足時可能清除資料，加到主畫面並定期備份比較保險。';
  } catch { /* 忽略 */ }
}

// ---------- 事件 ----------

const actions = {
  tab: el => go(el.dataset.tab),
  closeSheet,
  newBill: () => billForm(null),
  presetBill: el => billForm(null, L.BILL_PRESETS[Number(el.dataset.i)]),
  editBill: el => { const b = findBill(el.dataset.id); if (b) billForm(b); },
  payBill: el => payBill(el.dataset.id),
  deleteBill: el => deleteBill(el.dataset.id),
  icsOne: el => { const b = findBill(el.dataset.id); if (b) downloadICS([b], `繳費提醒-${b.name}.ics`); },
  icsAll: () => downloadICS(activeBills().sort(byDue), '生活助理繳費提醒.ics'),
  newCard: () => cardForm(null),
  editCard: el => { const c = findCard(el.dataset.id); if (c) cardForm(c); },
  deleteCard: el => deleteCard(el.dataset.id),
  addReward: () => {
    const rows = $('#reward-rows');
    rows.insertAdjacentHTML('beforeend', rewardRow({ cat: '', rate: '', note: '' }));
    rows.lastElementChild.querySelector('input').focus();
  },
  delReward: el => el.closest('.reward-row').remove(),
  pickCat: el => { state.ui.cat = el.dataset.cat; save(); render(); },
  newRecipe: () => recipeForm(null),
  openRecipe: el => openRecipe(el.dataset.id),
  editRecipe: el => { const r = findRecipe(el.dataset.id); if (r) recipeForm(r); },
  deleteRecipe: el => deleteRecipe(el.dataset.id),
  togglePlan: el => {
    const id = el.dataset.id;
    const i = state.plan.indexOf(id);
    if (i >= 0) state.plan.splice(i, 1);
    else state.plan.push(id);
    save();
    render();
    if (el.dataset.from === 'sheet') openRecipe(id);
    else if (i < 0) toast('已加入本週要煮');
  },
  reroll: () => { pickDish(true); render(); },
  dishTag: el => { state.ui.dishTag = el.dataset.tag; pickDish(true); render(); },
  menuTab: el => { state.ui.menuTab = el.dataset.k; save(); render(); },
  clearPlan: () => {
    const prev = [...state.plan];
    state.plan = [];
    save();
    render();
    toast('已清空本週', '復原', () => { state.plan = prev; save(); render(); });
  },
  checkItem: el => {
    if (el.checked) state.shopping.checked[el.dataset.key] = true;
    else delete state.shopping.checked[el.dataset.key];
    el.closest('label').classList.toggle('done', el.checked);
    save();
  },
  checkExtra: el => {
    const x = state.shopping.extra.find(i => i.id === el.dataset.id);
    if (x) x.done = el.checked;
    el.closest('label').classList.toggle('done', el.checked);
    save();
  },
  addExtra: () => {
    const input = $('#extra-input');
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    state.shopping.extra.push({ id: uid(), text: text.slice(0, 40), done: false });
    save();
    render();
    $('#extra-input').focus();
  },
  delExtra: el => { state.shopping.extra = state.shopping.extra.filter(x => x.id !== el.dataset.id); save(); render(); },
  copyShop: async () => {
    const checked = state.shopping.checked;
    const lines = L.shoppingList(planRecipes()).filter(it => !checked[it.name]).map(it => `□ ${it.name}${it.qtys.length ? ` ${L.mergeQty(it.qtys)}` : ''}`);
    for (const x of state.shopping.extra) if (!x.done) lines.push(`□ ${x.text}`);
    if (!lines.length) { toast('沒有要買的東西'); return; }
    const ok = await copyText(`買菜清單\n${lines.join('\n')}`);
    toast(ok ? `已複製 ${lines.length} 項，可以貼到 LINE` : '複製失敗，請手動選取');
  },
  clearChecked: () => {
    const prev = JSON.stringify(state.shopping);
    state.shopping.checked = {};
    state.shopping.extra = state.shopping.extra.filter(x => !x.done);
    save();
    render();
    toast('已清空勾選', '復原', () => { state.shopping = JSON.parse(prev); save(); render(); });
  },
  newTool: () => toolForm(null),
  editTool: el => { const t = findTool(el.dataset.id); if (t) toolForm(t); },
  deleteTool: el => deleteTool(el.dataset.id),
  moveTool: el => {
    const i = state.tools.findIndex(t => t.id === el.dataset.id);
    const j = i + Number(el.dataset.dir);
    if (i < 0 || j < 0 || j >= state.tools.length) return;
    [state.tools[i], state.tools[j]] = [state.tools[j], state.tools[i]];
    save();
    render();
  },
  pickIcon: el => {
    $('#sheet-form [name=icon]').value = el.dataset.icon;
    for (const b of $$('.icon-pick')) b.classList.toggle('on', b === el);
  },
  toggleEditTools: () => { state.ui.editTools = !state.ui.editTools; save(); render(); },
  exportData: () => exportData(),
  install: async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch { /* 忽略 */ }
    installPrompt = null;
    render();
  },
  wipe: () => {
    if (!confirm('確定要清除這台裝置上的所有資料嗎？無法復原。')) return;
    if (!confirm('再確認一次：繳費、信用卡、食譜、工具都會被刪除。建議先匯出備份。')) return;
    try { localStorage.removeItem(KEY); } catch { /* 忽略 */ }
    state = defaults();
    state.ui.tab = 'tools';
    save();
    render();
    toast('已清除所有資料');
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  fn(el, e);
});

$('.tabbar').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]');
  if (b) go(b.dataset.tab);
});

document.addEventListener('input', e => {
  if (e.target.id === 'recipe-q') {
    recipeQuery = e.target.value;
    $('#recipe-list').innerHTML = recipeListHTML();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'import-file' && e.target.files && e.target.files[0]) {
    importFile(e.target.files[0]);
    e.target.value = '';
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'extra-input' && !e.isComposing) {
    e.preventDefault();
    actions.addExtra();
  }
});

// 隔天打開時重新整理日期與自動扣繳。
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (rollAll()) save();
  if (renderedDay !== today()) render();
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  if (state.ui.tab === 'tools') render();
});

// ---------- 啟動 ----------

if (rollAll()) save();
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then(p => (p ? null : navigator.storage.persist())).catch(() => {});
}
