import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countSubjects } from '../js/detect.js';

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
