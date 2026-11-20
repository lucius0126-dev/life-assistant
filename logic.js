// 生活助理：純計算邏輯（日期、週期繳費、信用卡結帳、買菜清單、行事曆）。
// 不碰 DOM 與儲存，方便用 node verify-logic.mjs 測試。
// 日期一律用 'YYYY-MM-DD' 字串（本地日期），避免時區造成差一天。

export const pad = n => String(n).padStart(2, '0');
export const toStr = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export function parse(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return { y, m, d };
}

export function todayStr(now = new Date()) {
  return toStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// 月份可超出 1–12（自動進位），日期超過當月天數時夾到月底。
export function clampDate(y, m, d) {
  y += Math.floor((m - 1) / 12);
  m = (((m - 1) % 12) + 12) % 12 + 1;
  return toStr(y, m, Math.min(Math.max(1, d), daysInMonth(y, m)));
}

export function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const { y, m, d } = parse(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

const dayNum = s => { const { y, m, d } = parse(s); return Date.UTC(y, m - 1, d) / 86400000; };

export const diffDays = (from, to) => dayNum(to) - dayNum(from);

export function addDays(s, n) {
  const t = new Date((dayNum(s) + n) * 86400000);
  return toStr(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export const weekday = s => '日一二三四五六'[new Date(dayNum(s) * 86400000).getUTCDay()];

export function fmtShort(s) {
  const { m, d } = parse(s);
  return `${m}/${d}（${weekday(s)}）`;
}

// ---------- 週期繳費 ----------

export const EVERY_OPTIONS = [
  [1, '每月'], [2, '每兩個月'], [3, '每三個月'], [6, '每半年'], [12, '每年'], [0, '只有一次'],
];
export const everyLabel = every => (EVERY_OPTIONS.find(([v]) => v === every) || [0, '只有一次'])[1];

// 往後推 every 個月；anchorDay 是原本設定的日子，避免 31 號經過 2 月後變成 28 號。
export function advanceDue(dateStr, every, anchorDay) {
  const { y, m, d } = parse(dateStr);
  return clampDate(y, m + every, anchorDay || d);
}

// 每月某日：今天或之後最近的一次。
export function nextMonthlyOnOrAfter(today, day) {
  const { y, m } = parse(today);
  let s = clampDate(y, m, day);
  if (s < today) s = clampDate(y, m + 1, day);
  return s;
}

// 每年某月某日：今天或之後最近的一次。
export function nextYearlyOnOrAfter(today, month, day) {
  const { y } = parse(today);
  let s = clampDate(y, month, day);
  if (s < today) s = clampDate(y + 1, month, day);
  return s;
}

export function dueStatus(nextDue, today) {
  const days = diffDays(today, nextDue);
  const level = days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 3 ? 'soon' : days <= 7 ? 'week' : 'later';
  return { days, level };
}

export function dueLabel(days) {
  if (days < 0) return `已過 ${-days} 天`;
  if (days === 0) return '今天';
  if (days === 1) return '明天';
  return `${days} 天後`;
}

// 標記已繳：週期項目推到下一期，單次項目標記完成。回傳新的欄位（不直接改原物件）。
export function payBill(bill, today) {
  if (bill.every > 0) {
    return { nextDue: advanceDue(bill.nextDue, bill.every, bill.anchorDay), lastPaidAt: today };
  }
  return { doneAt: today, lastPaidAt: today };
}

// 自動扣繳的項目過了日期就自動往後推（不需要手動按已繳）。
export function rollAutopay(bill, today) {
  if (!bill.autopay || bill.doneAt) return null;
  if (bill.nextDue >= today) return null;
  if (!bill.every) return { doneAt: bill.nextDue };
  let next = bill.nextDue;
  for (let i = 0; i < 600 && next < today; i++) next = advanceDue(next, bill.every, bill.anchorDay);
  return { nextDue: next };
}

// 台灣常見的固定繳費／稅款，用來快速填表（日期可再自行修改）。
export const BILL_PRESETS = [
  { name: '電費', every: 2 },
  { name: '水費', every: 2 },
  { name: '電信費', every: 1 },
  { name: '房租', every: 1 },
  { name: '保險', every: 12 },
  { name: '牌照稅', every: 12, month: 4, day: 30, note: '每年 4/1–4/30 繳納' },
  { name: '房屋稅', every: 12, month: 5, day: 31, note: '每年 5/1–5/31 繳納' },
  { name: '綜合所得稅', every: 12, month: 5, day: 31, note: '每年 5/1–5/31 申報繳納' },
  { name: '汽機車燃料費', every: 12, month: 7, day: 31, note: '每年 7/1–7/31 繳納' },
  { name: '地價稅', every: 12, month: 11, day: 30, note: '每年 11/1–11/30 繳納' },
];

// ---------- 信用卡 ----------

export const GENERAL = '一般消費';
export const DEFAULT_CATEGORIES = ['超商', '外送', '餐廳', '網購', '國外', '加油', '交通', '超市量販', '行動支付', GENERAL];

// 今天刷的這筆會進哪一期帳單（結帳日當天刷的算本期）。
export function statementFor(purchase, statementDay) {
  const { y, m } = parse(purchase);
  let s = clampDate(y, m, statementDay);
  if (purchase > s) s = clampDate(y, m + 1, statementDay);
  return s;
}

// 結帳日之後第一個繳款日。
export function dueAfterStatement(statement, dueDay) {
  const { y, m } = parse(statement);
  let s = clampDate(y, m, dueDay);
  if (s <= statement) s = clampDate(y, m + 1, dueDay);
  return s;
}

export function payInfo(card, today) {
  const statement = statementFor(today, card.statementDay);
  const due = dueAfterStatement(statement, card.dueDay);
  return { statement, due, days: diffDays(today, due) };
}

export function rateFor(card, cat) {
  const rewards = Array.isArray(card.rewards) ? card.rewards : [];
  let best = null;
  for (const r of rewards) if (r.cat === cat && (!best || r.rate > best.rate)) best = r;
  if (best) return { rate: Number(best.rate) || 0, note: best.note || '', matched: true };
  let general = null;
  for (const r of rewards) if (r.cat === GENERAL && (!general || r.rate > general.rate)) general = r;
  return { rate: general ? Number(general.rate) || 0 : 0, note: general ? general.note || '' : '', matched: false };
}

// 依回饋率排序；回饋一樣時，有專屬回饋的優先，再比誰可以晚繳。
export function recommend(cards, cat, today) {
  return cards
    .map(card => ({ card, ...rateFor(card, cat), pay: payInfo(card, today) }))
    .sort((a, b) => (b.rate - a.rate) || (Number(b.matched) - Number(a.matched)) || (b.pay.days - a.pay.days));
}

// 偵測使用者是不是把完整卡號打進來（13–19 位數字，可夾空白或 -）。
export function looksLikeCardNumber(text) {
  return /(?:\d[ -]?){12,18}\d/.test(String(text || ''));
}

// ---------- 食譜與買菜清單 ----------

export function parseIngredient(line) {
  const t = String(line).trim().replace(/^[-*•・·\s]+/, '');
  if (!t) return null;
  let m = t.match(/^(.+?)\s*[:：]\s*(.+)$/);
  if (m) return { name: m[1].trim(), qty: m[2].trim() };
  m = t.match(/^(\S+)\s+(.+)$/);
  if (m) return { name: m[1], qty: m[2].trim() };
  m = t.match(/^(\D+?)(\d.*)$/);
  if (m) return { name: m[1], qty: m[2] };
  return { name: t, qty: '' };
}

export function shoppingList(recipes) {
  const map = new Map();
  for (const r of recipes) {
    for (const line of String(r.ingredients || '').split(/\r?\n/)) {
      const ing = parseIngredient(line);
      if (!ing) continue;
      if (!map.has(ing.name)) map.set(ing.name, { name: ing.name, qtys: [], from: [] });
      const item = map.get(ing.name);
      if (ing.qty) item.qtys.push(ing.qty);
      if (!item.from.includes(r.name)) item.from.push(r.name);
    }
  }
  return [...map.values()];
}

// 同單位的份量直接相加（1支＋1支 → 2支），單位不同就並列。
export function mergeQty(qtys) {
  if (!qtys.length) return '';
  const parsed = qtys.map(q => String(q).trim().match(/^(\d+(?:\.\d+)?)\s*(\D*)$/));
  if (parsed.every(Boolean) && parsed.every(p => p[2] === parsed[0][2])) {
    const sum = parsed.reduce((s, p) => s + Number(p[1]), 0);
    return `${Number(sum.toFixed(2))}${parsed[0][2]}`;
  }
  return qtys.join('＋');
}

export function parseTags(text) {
  return [...new Set(String(text || '').split(/[,，、\s]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean))];
}

// ---------- 行事曆（.ics） ----------

function icsEscape(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// RFC 5545：每行最多 75 bytes，續行以空白開頭。中文以 UTF-8 計算。
export function foldLine(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 75) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

export function rrule(every, anchorDay) {
  if (!every) return '';
  let r = `FREQ=MONTHLY;INTERVAL=${every}`;
  if (anchorDay >= 31) r += ';BYMONTHDAY=-1';
  else if (anchorDay >= 29) {
    const days = [];
    for (let d = 28; d <= anchorDay; d++) days.push(d);
    r += `;BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
  } else r += `;BYMONTHDAY=${anchorDay}`;
  return r;
}

// 全天事件從 00:00 開始；提前 N 天的早上 9 點提醒。
export function alarmTrigger(remindDays) {
  const n = Math.max(0, Math.floor(Number(remindDays) || 0));
  if (n === 0) return 'PT9H';
  if (n === 1) return '-PT15H';
  return `-P${n - 1}DT15H`;
}

const stamp = now => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function billSummary(bill) {
  const amount = bill.amount !== '' && bill.amount != null && !Number.isNaN(Number(bill.amount))
    ? ` NT$${Number(bill.amount).toLocaleString('en-US')}` : '';
  return `繳費：${bill.name}${amount}`;
}

// Google 日曆「新增活動」連結（只帶名稱和金額，不帶備註）。
export function googleCalendarUrl(bill) {
  const start = bill.nextDue.replace(/-/g, '');
  const end = addDays(bill.nextDue, 1).replace(/-/g, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: billSummary(bill), dates: `${start}/${end}` });
  const rule = rrule(bill.every, bill.anchorDay || parse(bill.nextDue).d);
  if (rule) p.set('recur', `RRULE:${rule}`);
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function buildICS(bills, { now = new Date(), describe = () => '' } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life Assistant//ZH-TW', 'CALSCALE:GREGORIAN'];
  for (const b of bills) {
    if (!isValidDate(b.nextDue)) continue;
    const start = b.nextDue.replace(/-/g, '');
    const end = addDays(b.nextDue, 1).replace(/-/g, '');
    const summary = billSummary(b);
    const desc = describe(b);
    lines.push('BEGIN:VEVENT', `UID:${b.id}@life-assistant`, `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`);
    const rule = rrule(b.every, b.anchorDay || parse(b.nextDue).d);
    if (rule) lines.push(`RRULE:${rule}`);
    lines.push(`SUMMARY:${icsEscape(summary)}`);
    if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    lines.push('TRANSP:TRANSPARENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(summary)}`,
      `TRIGGER:${alarmTrigger(b.remindDays ?? 3)}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
