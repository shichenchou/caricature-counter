const DB_NAME = 'caricature-counter';
const DB_VERSION = 1;
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('projects', { keyPath: 'id' });
        const records = db.createObjectStore('records', { keyPath: 'id' });
        records.createIndex('projectId', 'projectId');
        db.createObjectStore('photos', { keyPath: 'recordId' });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        db.onclose = () => { dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// fn 內只能發 IDB request，不能 await 其他非同步工作，否則 transaction 會自動結束
async function run(storeNames, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    let p;
    try {
      p = Promise.resolve(fn(tx));
    } catch (err) {
      p = Promise.reject(err);
    }
    p.then((r) => { result = r; }, (err) => {
      try { tx.abort(); } catch { /* 已結束的 transaction 不能 abort */ }
      reject(err);
    });
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listProjects() {
  const projects = await run(['projects'], 'readonly', (tx) => reqP(tx.objectStore('projects').getAll()));
  return projects.sort((a, b) => a.createdAt - b.createdAt);
}

export function saveProject(project) {
  return run(['projects'], 'readwrite', (tx) => { tx.objectStore('projects').put(project); });
}

export function listRecords(projectId) {
  return run(['records'], 'readonly', (tx) => reqP(tx.objectStore('records').index('projectId').getAll(projectId)));
}

export function saveRecord(record) {
  return run(['records'], 'readwrite', (tx) => { tx.objectStore('records').put(record); });
}

export function saveRecords(records) {
  return run(['records'], 'readwrite', (tx) => {
    const store = tx.objectStore('records');
    records.forEach((r) => store.put(r));
  });
}

export function addRecords(entries) {
  return run(['records', 'photos'], 'readwrite', (tx) => {
    const records = tx.objectStore('records');
    const photos = tx.objectStore('photos');
    for (const { record, photo } of entries) {
      records.add(record);
      photos.put({ recordId: record.id, original: photo.original, thumb: photo.thumb });
    }
  });
}

export function getPhoto(recordId) {
  return run(['photos'], 'readonly', (tx) => reqP(tx.objectStore('photos').get(recordId)));
}

export function deleteRecord(id) {
  return run(['records', 'photos'], 'readwrite', (tx) => {
    tx.objectStore('records').delete(id);
    tx.objectStore('photos').delete(id);
  });
}

export function deleteRecords(ids) {
  return run(['records', 'photos'], 'readwrite', (tx) => {
    const records = tx.objectStore('records');
    const photos = tx.objectStore('photos');
    for (const id of ids) {
      records.delete(id);
      photos.delete(id);
    }
  });
}

export function deleteProject(projectId) {
  return run(['projects', 'records', 'photos'], 'readwrite', (tx) => {
    tx.objectStore('projects').delete(projectId);
    const photos = tx.objectStore('photos');
    const cursorReq = tx.objectStore('records').index('projectId').openCursor(projectId);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      photos.delete(cursor.value.id);
      cursor.delete();
      cursor.continue();
    };
  });
}
