import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestCity, defaultTitle, TW_CITIES } from '../js/places.js';

test('TW_CITIES 有 22 縣市', () => {
  assert.equal(TW_CITIES.length, 22);
});

test('nearestCity：高雄市政府附近 → 高雄', () => {
  assert.equal(nearestCity(22.62, 120.31), '高雄');
});

test('nearestCity：台北 101 附近 → 台北', () => {
  assert.equal(nearestCity(25.0340, 121.5645), '台北');
});

test('nearestCity：金門 → 金門', () => {
  assert.equal(nearestCity(24.43, 118.32), '金門');
});

test('nearestCity：東京 → null', () => {
  assert.equal(nearestCity(35.68, 139.69), null);
});

test('defaultTitle：M/D 縣市，不補 0', () => {
  assert.equal(defaultTitle(new Date(2026, 10, 8), '高雄'), '11/8 高雄');
  assert.equal(defaultTitle(new Date(2026, 10, 8), null), '11/8');
});
