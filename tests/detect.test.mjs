import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countSubjects, mergeCount } from '../js/detect.js';

const person = (bbox, score = 0.9) => ({ class: 'person', score, bbox });
const face = (topLeft, bottomRight) => ({ topLeft, bottomRight });

test('countSubjects 只算 person/dog/cat 且分數 ≥ 0.5', () => {
  const preds = [
    { class: 'person', score: 0.9 },
    { class: 'person', score: 0.4 },
    { class: 'dog', score: 0.7 },
    { class: 'cat', score: 0.5 },
    { class: 'chair', score: 0.99 },
  ];
  assert.equal(countSubjects(preds), 3);
});

// 以下兩組為樣本照片在 640 畫布上的實測框
test('mergeCount 樣本 1_a：一人一臉 → 1', () => {
  const preds = [person([110, 68, 212, 565], 0.89), { class: 'chair', score: 0.7, bbox: [0, 400, 100, 200] }];
  assert.equal(mergeCount(preds, [face([167, 120], [230, 230])]), 1);
});

test('mergeCount 樣本 4_b：3 個人框 + 1 張框外臉 → 4', () => {
  const preds = [person([67, 106, 216, 354], 0.89), person([201, 222, 168, 247], 0.82), person([303, 182, 254, 297], 0.81)];
  const faces = [face([344, 247], [503, 367]), face([143, 161], [254, 244]), face([456, 91], [593, 194])];
  assert.equal(mergeCount(preds, faces), 4);
});

test('mergeCount WebKit 1_a：沒臉的 0.59 假人框不算 → 1', () => {
  const preds = [person([110, 68, 212, 565], 0.89), person([211, 344, 143, 289], 0.59)];
  assert.equal(mergeCount(preds, [face([167, 120], [230, 230])]), 1);
});

test('mergeCount WebKit 4_b：4 個人框 + 3 張臉 → 4', () => {
  const preds = [
    person([65, 105, 217, 351], 0.91), person([201, 222, 168, 246], 0.86),
    person([359, 28, 284, 435], 0.86), person([303, 182, 254, 298], 0.85),
  ];
  const faces = [face([343, 246], [503, 366]), face([143, 161], [254, 244]), face([455, 90], [593, 194])];
  assert.equal(mergeCount(preds, faces), 4);
});

test('mergeCount 沒臉的人框要 ≥ 0.7 才算；有臉的 ≥ 0.5 就算', () => {
  const dog = { class: 'dog', score: 0.6, bbox: [0, 0, 10, 10] };
  assert.equal(mergeCount([person([0, 0, 100, 100], 0.65), dog], []), 1);
  assert.equal(mergeCount([person([0, 0, 100, 100], 0.75), dog], []), 2);
  assert.equal(mergeCount([person([0, 0, 100, 100], 0.55)], [face([40, 40], [60, 60])]), 1);
});

test('mergeCount 沒有人框：每張臉算一人，狗貓照算', () => {
  const faces = [face([0, 0], [10, 10]), face([50, 50], [60, 60])];
  assert.equal(mergeCount([{ class: 'cat', score: 0.8, bbox: [100, 100, 50, 50] }], faces), 3);
});

test('mergeCount 分數 < 0.5 的人框不吸收臉', () => {
  assert.equal(mergeCount([person([0, 0, 100, 100], 0.4)], [face([40, 40], [60, 60])]), 1);
});

test('mergeCount 同一人框兩張臉 → 算 2 人', () => {
  const faces = [face([10, 10], [30, 30]), face([60, 10], [80, 30])];
  assert.equal(mergeCount([person([0, 0, 100, 200])], faces), 2);
});

test('mergeCount 重疊框：只能配一個框的臉先配，避免被搶走', () => {
  // 臉 A 中心在大小兩框重疊處，臉 B 只在小框；A 若先搶最小框，B 會被誤算成多一人
  const preds = [person([0, 0, 250, 400]), person([200, 200, 100, 100])];
  const faces = [face([215, 210], [235, 230]), face([280, 280], [298, 298])];
  assert.equal(mergeCount(preds, faces), 2);
  assert.equal(mergeCount(preds, [faces[0]]), 2);
});

test('mergeCount 臉中心落在狗貓框（沒人框）不加人：1 人 + 1 狗 → 2', () => {
  const preds = [person([0, 0, 100, 300]), { class: 'dog', score: 0.8, bbox: [200, 200, 100, 100] }];
  const faces = [face([30, 20], [70, 60]), face([230, 220], [270, 260])];
  assert.equal(mergeCount(preds, faces), 2);
});
