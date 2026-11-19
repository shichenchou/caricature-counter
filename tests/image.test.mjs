import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout, releaseCanvas } from '../js/image.js';

test('withTimeout 在時限內完成就回傳結果', async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50, '逾時'), 7);
});

test('withTimeout 超過時限 reject 指定訊息', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20, '圖片轉檔逾時'), { message: '圖片轉檔逾時' });
});

test('withTimeout 保留原本的錯誤', async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error('壞掉')), 50, '逾時'), { message: '壞掉' });
});

test('releaseCanvas 把尺寸歸零，null 不報錯', () => {
  const c = { width: 640, height: 480 };
  releaseCanvas(c);
  assert.deepEqual(c, { width: 0, height: 0 });
  releaseCanvas(null);
});
