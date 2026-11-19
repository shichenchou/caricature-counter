// 獨立檔案：node --test 每個檔案各跑一個 process，db.js 的連線快取不會被其他測試先開成 v2
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function openV1() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('caricature-counter', 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('projects', { keyPath: 'id' });
      const records = d.createObjectStore('records', { keyPath: 'id' });
      records.createIndex('projectId', 'projectId');
      d.createObjectStore('photos', { keyPath: 'recordId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function seedV1(d) {
  return new Promise((resolve, reject) => {
    const tx = d.transaction(['projects', 'records', 'photos'], 'readwrite');
    tx.objectStore('projects').put({ id: 'p1', title: 'A', maxQuota: 40, allowWaitingList: false, createdAt: 1 });
    for (const id of ['r1', 'r2']) {
      tx.objectStore('records').put({ id, projectId: 'p1', seq: 1, count: 1, isSent: false, sentAt: null, createdAt: 1 });
      tx.objectStore('photos').put({ recordId: id, original: `O-${id}`, thumb: `T-${id}` });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

test('v1 舊資料升級到 v2：縮圖搬進 thumbs，原圖與紀錄不變', async () => {
  const v1 = await openV1();
  await seedV1(v1);
  v1.close();

  const db = await import('../js/db.js');
  assert.equal(await db.getThumb('r1'), 'T-r1');
  assert.equal(await db.getThumb('r2'), 'T-r2');
  const photo = await db.getPhoto('r1');
  assert.equal(photo.original, 'O-r1');
  assert.equal(photo.thumb, 'T-r1');
  assert.deepEqual((await db.listRecords('p1')).map((r) => r.id).sort(), ['r1', 'r2']);
  assert.deepEqual((await db.listProjects()).map((p) => p.id), ['p1']);

  await db.deleteProject('p1');
  assert.equal(await db.getThumb('r1'), undefined);
  assert.equal(await db.getPhoto('r2'), undefined);
});
