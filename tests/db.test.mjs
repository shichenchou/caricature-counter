import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as db from '../js/db.js';

const r = (id, projectId, extra = {}) => ({ id, projectId, seq: 1, count: 2, aiCount: 2, isSent: false, sentAt: null, createdAt: 1, ...extra });

test('專案、紀錄、照片的存取與連帶刪除', async () => {
  await db.saveProject({ id: 'p1', title: 'A', maxQuota: 40, allowWaitingList: false, createdAt: 2 });
  await db.saveProject({ id: 'p2', title: 'B', maxQuota: 10, allowWaitingList: true, createdAt: 1 });
  assert.deepEqual((await db.listProjects()).map((p) => p.id), ['p2', 'p1']);

  await db.addRecords([
    { record: r('r1', 'p1'), photo: { original: 'O1', thumb: 'T1' } },
    { record: r('r2', 'p2'), photo: { original: 'O2', thumb: 'T2' } },
  ]);
  assert.deepEqual((await db.listRecords('p1')).map((x) => x.id), ['r1']);
  const photo = await db.getPhoto('r1');
  assert.equal(photo.original, 'O1');
  assert.equal(photo.thumb, 'T1');

  await db.saveRecord(r('r1', 'p1', { count: 5 }));
  assert.equal((await db.listRecords('p1'))[0].count, 5);
  await db.saveRecords([r('r1', 'p1', { isSent: true, sentAt: 9 })]);
  assert.equal((await db.listRecords('p1'))[0].isSent, true);

  await db.deleteRecord('r1');
  assert.equal((await db.listRecords('p1')).length, 0);
  assert.equal(await db.getPhoto('r1'), undefined);

  await db.addRecords([{ record: r('r3', 'p1'), photo: { original: 'O3', thumb: 'T3' } }]);
  await db.deleteProject('p1');
  assert.deepEqual((await db.listProjects()).map((p) => p.id), ['p2']);
  assert.equal((await db.listRecords('p1')).length, 0);
  assert.equal(await db.getPhoto('r3'), undefined);
  assert.equal((await db.listRecords('p2')).length, 1);
});

test('addRecords 中途丟錯時整批不寫入', async () => {
  await assert.rejects(db.addRecords([
    { record: r('x1', 'p9'), photo: { original: 'O', thumb: 'T' } },
    { record: r('x2', 'p9'), photo: { original: () => {}, thumb: 'T' } },
  ]));
  assert.equal((await db.listRecords('p9')).length, 0);
  assert.equal(await db.getPhoto('x1'), undefined);
});

test('deleteRecords 一次刪多筆紀錄和照片，其他筆不受影響', async () => {
  await db.addRecords([
    { record: r('d1', 'p5'), photo: { original: 'O', thumb: 'T' } },
    { record: r('d2', 'p5'), photo: { original: 'O', thumb: 'T' } },
    { record: r('d3', 'p5'), photo: { original: 'O', thumb: 'T' } },
  ]);
  await db.deleteRecords(['d1', 'd2']);
  assert.deepEqual((await db.listRecords('p5')).map((x) => x.id), ['d3']);
  assert.equal(await db.getPhoto('d1'), undefined);
  assert.equal(await db.getPhoto('d2'), undefined);
  assert.equal((await db.getPhoto('d3')).thumb, 'T');
});
