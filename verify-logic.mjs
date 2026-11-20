// 執行：node verify-logic.mjs
import assert from 'node:assert/strict';
import * as L from './logic.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

test('月底夾日與跨年', () => {
  assert.equal(L.clampDate(2026, 2, 31), '2026-02-28');
  assert.equal(L.clampDate(2028, 2, 31), '2028-02-29');
  assert.equal(L.clampDate(2026, 13, 5), '2027-01-05');
  assert.equal(L.clampDate(2026, 0, 5), '2025-12-05');
});

test('天數差與星期', () => {
  assert.equal(L.diffDays('2026-11-20', '2026-11-23'), 3);
  assert.equal(L.diffDays('2026-12-31', '2027-01-01'), 1);
  assert.equal(L.diffDays('2026-11-20', '2026-11-19'), -1);
  assert.equal(L.weekday('2026-11-20'), '五');
  assert.equal(L.fmtShort('2026-11-23'), '11/23（一）');
  assert.equal(L.addDays('2026-02-28', 1), '2026-03-01');
});

test('日期格式檢查', () => {
  assert.ok(L.isValidDate('2026-02-28'));
  assert.ok(!L.isValidDate('2026-02-30'));
  assert.ok(!L.isValidDate('2026-2-3'));
  assert.ok(!L.isValidDate(''));
});

test('週期推進保留原本的日子（31 號不會漂移）', () => {
  assert.equal(L.advanceDue('2026-01-31', 1, 31), '2026-02-28');
  assert.equal(L.advanceDue('2026-02-28', 1, 31), '2026-03-31');
  assert.equal(L.advanceDue('2026-11-15', 2, 15), '2027-01-15');
  assert.equal(L.advanceDue('2026-04-30', 12, 30), '2027-04-30');
});

test('下一次每月／每年日期', () => {
  assert.equal(L.nextMonthlyOnOrAfter('2026-11-20', 20), '2026-11-20');
  assert.equal(L.nextMonthlyOnOrAfter('2026-11-20', 5), '2026-12-05');
  assert.equal(L.nextMonthlyOnOrAfter('2026-12-25', 3), '2027-01-03');
  assert.equal(L.nextYearlyOnOrAfter('2026-11-20', 11, 30), '2026-11-30');
  assert.equal(L.nextYearlyOnOrAfter('2026-11-20', 4, 30), '2027-04-30');
});

test('到期狀態與文字', () => {
  assert.deepEqual(L.dueStatus('2026-11-19', '2026-11-20'), { days: -1, level: 'overdue' });
  assert.equal(L.dueStatus('2026-11-20', '2026-11-20').level, 'today');
  assert.equal(L.dueStatus('2026-11-23', '2026-11-20').level, 'soon');
  assert.equal(L.dueStatus('2026-11-27', '2026-11-20').level, 'week');
  assert.equal(L.dueStatus('2026-11-28', '2026-11-20').level, 'later');
  assert.equal(L.dueLabel(-2), '已過 2 天');
  assert.equal(L.dueLabel(0), '今天');
  assert.equal(L.dueLabel(1), '明天');
  assert.equal(L.dueLabel(5), '5 天後');
});

test('標記已繳', () => {
  assert.deepEqual(L.payBill({ every: 1, nextDue: '2026-11-20', anchorDay: 20 }, '2026-11-18'),
    { nextDue: '2026-12-20', lastPaidAt: '2026-11-18' });
  assert.deepEqual(L.payBill({ every: 0, nextDue: '2026-11-30' }, '2026-11-20'),
    { doneAt: '2026-11-20', lastPaidAt: '2026-11-20' });
});

test('自動扣繳過期自動推進', () => {
  assert.equal(L.rollAutopay({ autopay: false, every: 1, nextDue: '2026-09-01', anchorDay: 1 }, '2026-11-20'), null);
  assert.equal(L.rollAutopay({ autopay: true, every: 1, nextDue: '2026-11-25', anchorDay: 25 }, '2026-11-20'), null);
  assert.deepEqual(L.rollAutopay({ autopay: true, every: 1, nextDue: '2026-09-01', anchorDay: 1 }, '2026-11-20'),
    { nextDue: '2026-12-01' });
  assert.deepEqual(L.rollAutopay({ autopay: true, every: 2, nextDue: '2026-11-20', anchorDay: 20 }, '2026-11-20'), null);
  assert.deepEqual(L.rollAutopay({ autopay: true, every: 0, nextDue: '2026-10-01' }, '2026-11-20'), { doneAt: '2026-10-01' });
});

test('信用卡：今天刷會進哪一期、何時要繳', () => {
  const a = { statementDay: 5, dueDay: 20 };      // 當月繳
  const b = { statementDay: 19, dueDay: 3 };      // 次月繳
  assert.deepEqual(L.payInfo(a, '2026-11-20'), { statement: '2026-12-05', due: '2026-12-20', days: 30 });
  assert.deepEqual(L.payInfo(a, '2026-11-05'), { statement: '2026-11-05', due: '2026-11-20', days: 15 });
  assert.deepEqual(L.payInfo(b, '2026-11-20'), { statement: '2026-12-19', due: '2027-01-03', days: 44 });
  assert.deepEqual(L.payInfo(b, '2026-11-19'), { statement: '2026-11-19', due: '2026-12-03', days: 14 });
  // 31 號結帳遇到 2 月
  assert.equal(L.statementFor('2026-02-28', 31), '2026-02-28');
  assert.equal(L.statementFor('2026-03-01', 31), '2026-03-31');
});

test('刷卡推薦排序', () => {
  const cards = [
    { id: 'a', statementDay: 5, dueDay: 20, rewards: [{ cat: '超商', rate: 5 }, { cat: '一般消費', rate: 1 }] },
    { id: 'b', statementDay: 19, dueDay: 3, rewards: [{ cat: '國外', rate: 3 }, { cat: '一般消費', rate: 1.2 }] },
    { id: 'c', statementDay: 10, dueDay: 25, rewards: [] },
  ];
  const r1 = L.recommend(cards, '超商', '2026-11-20');
  assert.deepEqual(r1.map(x => x.card.id), ['a', 'b', 'c']);
  assert.equal(r1[0].rate, 5);
  assert.equal(r1[0].matched, true);
  const r2 = L.recommend(cards, '加油', '2026-11-20');
  assert.deepEqual(r2.map(x => x.card.id), ['b', 'a', 'c']);
  assert.equal(r2[0].matched, false);
  const r3 = L.recommend(cards, '國外', '2026-11-20');
  assert.equal(r3[0].card.id, 'b');
});

test('偵測完整卡號', () => {
  assert.ok(L.looksLikeCardNumber('4111 1111 1111 1111'));
  assert.ok(L.looksLikeCardNumber('卡號4111-1111-1111-1111'));
  assert.ok(L.looksLikeCardNumber('4111111111111111'));
  assert.ok(!L.looksLikeCardNumber('1234'));
  assert.ok(!L.looksLikeCardNumber('0912-345-678'));
  assert.ok(!L.looksLikeCardNumber('每月上限 300 元，2026-12-31 前'));
});

test('食材解析與買菜清單合併', () => {
  assert.deepEqual(L.parseIngredient('番茄 2顆'), { name: '番茄', qty: '2顆' });
  assert.deepEqual(L.parseIngredient('番茄　2顆'), { name: '番茄', qty: '2顆' });
  assert.deepEqual(L.parseIngredient('雞蛋3顆'), { name: '雞蛋', qty: '3顆' });
  assert.deepEqual(L.parseIngredient('醬油：2大匙'), { name: '醬油', qty: '2大匙' });
  assert.deepEqual(L.parseIngredient('- 鹽 少許'), { name: '鹽', qty: '少許' });
  assert.deepEqual(L.parseIngredient('九層塔'), { name: '九層塔', qty: '' });
  assert.equal(L.parseIngredient('   '), null);
  const list = L.shoppingList([
    { name: '番茄炒蛋', ingredients: '番茄 2顆\n雞蛋 3顆\n蔥 1支' },
    { name: '味噌湯', ingredients: '豆腐 1盒\n蔥 1支\n\n' },
  ]);
  assert.equal(list.length, 4);
  const scallion = list.find(i => i.name === '蔥');
  assert.deepEqual(scallion.qtys, ['1支', '1支']);
  assert.deepEqual(scallion.from, ['番茄炒蛋', '味噌湯']);
});

test('份量合併', () => {
  assert.equal(L.mergeQty(['1支', '1支']), '2支');
  assert.equal(L.mergeQty(['1.5大匙', '2大匙']), '3.5大匙');
  assert.equal(L.mergeQty(['2顆', '少許']), '2顆＋少許');
  assert.equal(L.mergeQty(['150g', '1盒']), '150g＋1盒');
  assert.equal(L.mergeQty(['少許']), '少許');
  assert.equal(L.mergeQty([]), '');
});

test('標籤解析', () => {
  assert.deepEqual(L.parseTags('家常, 快速、#下飯 快速'), ['家常', '快速', '下飯']);
  assert.deepEqual(L.parseTags(''), []);
});

test('行事曆 RRULE 與提醒時間', () => {
  assert.equal(L.rrule(0, 5), '');
  assert.equal(L.rrule(1, 20), 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=20');
  assert.equal(L.rrule(2, 31), 'FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=-1');
  assert.equal(L.rrule(12, 30), 'FREQ=MONTHLY;INTERVAL=12;BYMONTHDAY=28,29,30;BYSETPOS=-1');
  assert.equal(L.alarmTrigger(0), 'PT9H');
  assert.equal(L.alarmTrigger(1), '-PT15H');
  assert.equal(L.alarmTrigger(3), '-P2DT15H');
});

test('行事曆檔案格式', () => {
  const ics = L.buildICS([
    { id: 'x1', name: '中華電信, 手機; 家用', amount: 599, nextDue: '2026-11-23', every: 1, anchorDay: 23, remindDays: 3 },
    { id: 'x2', name: '地價稅', amount: '', nextDue: '2026-11-30', every: 0, remindDays: 0 },
    { id: 'bad', name: '壞資料', nextDue: 'oops', every: 1 },
  ], { now: new Date('2026-11-20T08:30:00Z'), describe: b => b.id === 'x1' ? '自動扣繳\n國泰卡' : '' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261123'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261124'));
  assert.ok(ics.includes('RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=23'));
  assert.ok(ics.includes('SUMMARY:繳費：中華電信\\, 手機\\; 家用 NT$599'));
  assert.ok(ics.includes('DESCRIPTION:自動扣繳\\n國泰卡'));
  assert.ok(ics.includes('TRIGGER:-P2DT15H'));
  assert.ok(ics.includes('TRIGGER:PT9H'));
  assert.ok(ics.includes('DTSTAMP:20261120T083000Z'));
  // 單次項目沒有 RRULE
  const second = ics.split('BEGIN:VEVENT')[2];
  assert.ok(!second.includes('RRULE'));
  // 每行不超過 75 bytes
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, line);
});

test('長中文行折行後可還原', () => {
  const long = 'DESCRIPTION:' + '這是一段很長的中文說明'.repeat(10);
  const folded = L.foldLine(long);
  assert.ok(folded.includes('\r\n '));
  assert.equal(folded.replace(/\r\n /g, ''), long);
});

console.log(`\n${passed} 項測試全部通過`);
