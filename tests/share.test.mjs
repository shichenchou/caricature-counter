import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeName, fileNameFor, shareFiles } from '../js/share.js';

test('safeName 把斜線空白換成 -', () => {
  assert.equal(safeName('11/8 高雄'), '11-8-高雄');
});

test('fileNameFor：正取兩位數、備取加「備」、依類型給副檔名', () => {
  assert.equal(fileNameFor('11/8 高雄', { no: 3, isWaiting: false, count: 2 }, 'image/jpeg'), '11-8-高雄_03_2人.jpg');
  assert.equal(fileNameFor('A', { no: 1, isWaiting: true, count: 1 }, 'image/heic'), 'A_備1_1人.heic');
  assert.equal(fileNameFor('A', { no: 1, isWaiting: false, count: 1 }, ''), 'A_01_1人.jpg');
});

test('shareFiles：不支援時回 unsupported', async () => {
  assert.equal(await shareFiles([], 't', {}), 'unsupported');
  assert.equal(await shareFiles([], 't', { canShare: () => false, share: async () => {} }), 'unsupported');
});

test('shareFiles：成功 shared、取消 cancelled、其他錯 error', async () => {
  const ok = { canShare: () => true, share: async () => {} };
  assert.equal(await shareFiles([], 't', ok), 'shared');
  const abort = { canShare: () => true, share: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; } };
  assert.equal(await shareFiles([], 't', abort), 'cancelled');
  const fail = { canShare: () => true, share: async () => { throw new Error('boom'); } };
  assert.equal(await shareFiles([], 't', fail), 'error');
});
