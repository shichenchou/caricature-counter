import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatus, clampQuota } from '../js/quota.js';

const rec = (seq, count, extra = {}) => ({ id: `r${seq}`, seq, count, isSent: false, sentAt: null, ...extra });
const proj = (maxQuota, allowWaitingList = false) => ({ maxQuota, allowWaitingList });

test('未滿額：全部正取、狀態 open', () => {
  const st = computeStatus(proj(40), [rec(1, 2), rec(2, 3)]);
  assert.equal(st.regularCount, 5);
  assert.equal(st.waitingCount, 0);
  assert.equal(st.total, 5);
  assert.equal(st.remaining, 35);
  assert.equal(st.state, 'open');
  assert.deepEqual(st.items.map(i => [i.no, i.isWaiting]), [[1, false], [2, false]]);
});

test('剛好 40 人：full', () => {
  const st = computeStatus(proj(40), [rec(1, 40)]);
  assert.equal(st.state, 'full');
  assert.equal(st.remaining, 0);
});

test('39 人時來 2 人：整組正取 41/40，沒開備取為 over', () => {
  const st = computeStatus(proj(40), [rec(1, 39), rec(2, 2)]);
  assert.equal(st.regularCount, 41);
  assert.equal(st.remaining, -1);
  assert.equal(st.state, 'over');
  assert.equal(st.items[1].isWaiting, false);
});

test('沒開備取時再多組也都是正取', () => {
  const st = computeStatus(proj(40), [rec(1, 41), rec(2, 3)]);
  assert.equal(st.items[1].isWaiting, false);
  assert.equal(st.regularCount, 44);
});

test('開備取：滿額後的組變備取，備取另外編號', () => {
  const st = computeStatus(proj(40, true), [rec(1, 39), rec(2, 2), rec(3, 1), rec(4, 3)]);
  assert.equal(st.regularCount, 41);
  assert.equal(st.waitingCount, 4);
  assert.equal(st.total, 45);
  assert.equal(st.state, 'waiting');
  assert.deepEqual(st.items.map(i => [i.isWaiting, i.no]), [[false, 1], [false, 2], [true, 1], [true, 2]]);
});

test('開備取且剛好滿額：狀態 waiting（下一組會進備取）', () => {
  const st = computeStatus(proj(40, true), [rec(1, 40)]);
  assert.equal(st.state, 'waiting');
});

test('依 seq 排序，不依陣列順序', () => {
  const st = computeStatus(proj(40), [rec(2, 1), rec(1, 1)]);
  assert.deepEqual(st.items.map(i => i.id), ['r1', 'r2']);
});

test('前面人數變少，備取自動遞補成正取', () => {
  const before = computeStatus(proj(40, true), [rec(1, 40), rec(2, 2), rec(3, 1)]);
  assert.equal(before.items[1].isWaiting, true);
  const after = computeStatus(proj(40, true), [rec(1, 39), rec(2, 2), rec(3, 1)]);
  assert.equal(after.items[1].isWaiting, false);
  assert.equal(after.items[2].isWaiting, true);
  assert.equal(after.items[2].no, 1);
});

test('名額 0 + 開備取：全部備取', () => {
  const st = computeStatus(proj(0, true), [rec(1, 2), rec(2, 1)]);
  assert.equal(st.regularCount, 0);
  assert.equal(st.waitingCount, 3);
});

test('傳送統計：已傳張數、未傳人數', () => {
  const st = computeStatus(proj(40), [rec(1, 2, { isSent: true }), rec(2, 3), rec(3, 1, { isSent: true })]);
  assert.equal(st.sentPhotos, 2);
  assert.equal(st.unsentPeople, 3);
  assert.equal(st.unsentPhotos, 1);
});

test('不改動傳入的 records', () => {
  const records = [rec(2, 1), rec(1, 1)];
  computeStatus(proj(40), records);
  assert.deepEqual(records.map(r => r.id), ['r2', 'r1']);
  assert.equal('no' in records[0], false);
});

test('clampQuota：限制 0~100 並四捨五入', () => {
  assert.equal(clampQuota('150'), 100);
  assert.equal(clampQuota('-3'), 0);
  assert.equal(clampQuota('abc'), 0);
  assert.equal(clampQuota('40.6'), 41);
  assert.equal(clampQuota(40), 40);
});
