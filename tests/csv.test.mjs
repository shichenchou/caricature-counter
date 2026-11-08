import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, formatTime, pad2, csvCell } from '../js/csv.js';

test('pad2', () => {
  assert.equal(pad2(3), '03');
  assert.equal(pad2(12), '12');
});

test('formatTime 用本地時間（測試以 TZ=Asia/Taipei 執行）', () => {
  assert.equal(formatTime(Date.UTC(2026, 10, 8, 2, 5)), '2026-11-08 10:05');
});

test('csvCell 跳脫逗號與引號', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell(3), '3');
});

test('toCsv：BOM、表頭、正備取、傳送時間', () => {
  const status = {
    items: [
      { no: 1, isWaiting: false, count: 2, createdAt: Date.UTC(2026, 10, 8, 2, 5), isSent: true, sentAt: Date.UTC(2026, 10, 8, 2, 30) },
      { no: 1, isWaiting: true, count: 1, createdAt: Date.UTC(2026, 10, 8, 3, 0), isSent: false, sentAt: null },
    ],
  };
  const csv = toCsv(status);
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], '編號,正備取,人數,加入時間,已傳給老師,傳送時間');
  assert.equal(lines[1], '#01,正取,2,2026-11-08 10:05,是,2026-11-08 10:30');
  assert.equal(lines[2], '備1,備取,1,2026-11-08 11:00,否,');
});
