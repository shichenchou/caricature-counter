import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPassword, sha256Hex, PASS_HASH } from '../js/gate.js';

// 公開 repo：測試不放真正密碼，用測試向量驗證比對邏輯
const ABC_HASH = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

test('sha256Hex：標準測試向量 abc', async () => {
  assert.equal(await sha256Hex('abc'), ABC_HASH);
});

test('checkPassword：符合指紋通過、前後空白會去掉', async () => {
  assert.equal(await checkPassword('abc', ABC_HASH), true);
  assert.equal(await checkPassword(' abc ', ABC_HASH), true);
});

test('checkPassword：不符合不通過', async () => {
  assert.equal(await checkPassword('abd', ABC_HASH), false);
  assert.equal(await checkPassword('', ABC_HASH), false);
});

test('PASS_HASH 是 64 位 hex 指紋', () => {
  assert.match(PASS_HASH, /^[0-9a-f]{64}$/);
});

test('真實密碼（有設 CC_PASSWORD 才測）', { skip: !process.env.CC_PASSWORD }, async () => {
  assert.equal(await checkPassword(process.env.CC_PASSWORD), true);
});
