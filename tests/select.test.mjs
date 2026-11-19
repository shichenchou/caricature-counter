import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectAll, selectNone, invert, selectUnsent, selectUnsynced } from '../js/select.js';

const items = [
  { id: 'a', isSent: false, albumSaved: false },
  { id: 'b', isSent: true, albumSaved: true },
  { id: 'c', isSent: false, albumSaved: true },
  { id: 'd', isSent: true },
];
const ids = (set) => [...set].sort();

test('selectAll 選全部', () => {
  assert.deepEqual(ids(selectAll(items)), ['a', 'b', 'c', 'd']);
  assert.equal(selectAll([]).size, 0);
});

test('selectNone 回傳空集合', () => {
  assert.equal(selectNone().size, 0);
});

test('invert 反選，且忽略已不在列表的 id', () => {
  assert.deepEqual(ids(invert(items, new Set(['a', 'c', 'gone']))), ['b', 'd']);
  assert.deepEqual(ids(invert(items, new Set())), ['a', 'b', 'c', 'd']);
});

test('selectUnsent 只選未傳送', () => {
  assert.deepEqual(ids(selectUnsent(items)), ['a', 'c']);
});

test('selectUnsynced 選 albumSaved 不是 true 的（含舊資料沒有欄位）', () => {
  assert.deepEqual(ids(selectUnsynced(items)), ['a', 'd']);
});
