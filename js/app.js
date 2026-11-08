import * as db from './db.js';
import { computeStatus, clampQuota } from './quota.js';
import { prepareImage } from './image.js';
import { detectCount, loadModel } from './detect.js';
import { shareFiles, fileNameFor, safeName } from './share.js';
import { toCsv, formatTime, pad2 } from './csv.js';
import { nearestCity, defaultTitle } from './places.js';
import { setupGate } from './gate.js';

const ICONS = {
  trash: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};

const $ = (id) => document.getElementById(id);
const ACTIVE_KEY = 'cc.activeProjectId';
const STATE_LABEL = {
  open: '🟢 名額開放中',
  full: '🟡 名額已滿',
  over: '🟡 彈性超額中',
  waiting: '🟠 備取登記中',
};

const state = {
  projects: [],
  project: null,
  records: [],
  selected: new Set(),
  thumbUrls: new Map(),
  originals: new Map(),
  busy: false,
  thumbJobs: new Map(),
};

function readActive() {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
function writeActive(id) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* 私密模式等情況可忽略 */ }
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2500);
}

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function revokeThumbs() {
  for (const url of state.thumbUrls.values()) if (url) URL.revokeObjectURL(url);
  state.thumbUrls.clear();
  state.originals.clear();
  state.thumbJobs.clear();
}

function forgetRecord(id) {
  const url = state.thumbUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  state.thumbUrls.delete(id);
  state.originals.delete(id);
  state.thumbJobs.delete(id);
  state.selected.delete(id);
}

// 取縮圖時順便把原圖 Blob 留在記憶體，按傳送時才能不 await 直接叫分享選單
async function thumbUrl(recordId) {
  if (state.thumbUrls.has(recordId)) return state.thumbUrls.get(recordId);
  if (state.thumbJobs.has(recordId)) return state.thumbJobs.get(recordId);
  const job = (async () => {
    const photo = await db.getPhoto(recordId);
    if (state.thumbJobs.get(recordId) !== job) return '';
    state.thumbJobs.delete(recordId);
    if (!photo) return '';
    const url = URL.createObjectURL(new Blob([photo.thumb.data], { type: photo.thumb.type }));
    state.thumbUrls.set(recordId, url);
    state.originals.set(recordId, new Blob([photo.original.data], { type: photo.original.type }));
    return url;
  })();
  state.thumbJobs.set(recordId, job);
  return job;
}

async function switchProject(id) {
  revokeThumbs();
  state.selected.clear();
  state.project = state.projects.find((p) => p.id === id) ?? null;
  state.records = state.project ? await db.listRecords(state.project.id) : [];
  if (state.project) writeActive(state.project.id);
  render();
}

function renderProjectSelect() {
  const sel = $('projectSelect');
  sel.replaceChildren();
  if (!state.projects.length) {
    sel.append(new Option('（尚無場次）', ''));
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  for (const p of state.projects) sel.append(new Option(p.title, p.id, false, p.id === state.project?.id));
}

function renderStatus(st) {
  const p = state.project;
  const remainText = st.remaining >= 0 ? `剩 ${st.remaining}` : `超額 ${-st.remaining}`;
  const cells = [
    ['目前', `${st.total} 人`],
    ['正取', `${st.regularCount} / ${p.maxQuota}`],
    ...(p.allowWaitingList ? [['備取', `${st.waitingCount} 人`]] : []),
    ['名額', remainText],
    ['未傳送', `${st.unsentPhotos} 張照片\n共 ${st.unsentPeople} 人`],
    ['已傳送', `${st.sentPhotos} 張`],
  ];
  const el = $('statusBar');
  el.replaceChildren();
  const badge = document.createElement('div');
  badge.className = `badge state-${st.state}`;
  badge.textContent = STATE_LABEL[st.state];
  const grid = document.createElement('dl');
  grid.className = 'stats';
  for (const [k, v] of cells) {
    const box = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = k;
    dd.textContent = v;
    box.append(dt, dd);
    grid.append(box);
  }
  el.append(badge, grid);
}

function renderCard(item) {
  const li = document.createElement('li');
  li.className = `card ${item.isWaiting ? 'is-waiting' : 'is-regular'}${item.isSent ? ' is-sent' : ''}`;
  li.dataset.id = item.id;
  li.innerHTML = `
    <label class="pick"><input type="checkbox" class="pick-box" aria-label="勾選傳送"></label>
    <img class="thumb" alt="">
    <div class="body">
      <div class="tag"></div>
      <div class="counter">
        <button type="button" class="btn-round" data-act="dec" aria-label="減一">−</button>
        <span class="count"></span>
        <button type="button" class="btn-round" data-act="inc" aria-label="加一">＋</button>
      </div>
      <div class="sent"></div>
      <div class="album"></div>
    </div>
    <div class="card-actions">
      <button type="button" class="btn-small" data-act="send">🚀 AirDrop</button>
      <button type="button" class="btn-link" data-act="toggleSent"></button>
      <button type="button" class="btn-link btn-icon danger" data-act="delete" aria-label="刪除這一組">${ICONS.trash}</button>
    </div>`;
  li.querySelector('.tag').textContent = item.isWaiting ? `[ ⚠️ 備取第 ${item.no} 位 ]` : `#${pad2(item.no)} 正取`;
  li.querySelector('.count').textContent = `${item.count} 人`;
  li.querySelector('.sent').textContent = item.isSent
    ? `已傳給老師 🟢${item.sentAt ? ' ' + formatTime(item.sentAt).slice(11) : ''}`
    : '未傳送 ⏳';
  const album = li.querySelector('.album');
  album.classList.toggle('ok', item.albumSaved === true);
  album.textContent = item.albumSaved ? '📷 相簿已同步' : '相簿未同步';
  li.querySelector('[data-act=toggleSent]').textContent = item.isSent ? '改回未傳' : '標為已傳';
  li.querySelector('.pick-box').checked = state.selected.has(item.id);
  thumbUrl(item.id).then((url) => { li.querySelector('.thumb').src = url; });
  return li;
}

function updateSendButton() {
  const n = state.selected.size;
  $('selectionBar').hidden = n === 0;
  const btn = $('btnSendSelected');
  btn.disabled = n === 0;
  btn.textContent = `🚀 AirDrop（${n}）`;
  const save = $('btnSaveSelected');
  save.disabled = n === 0;
  save.textContent = `💾 存相簿（${n}）`;
  const del = $('btnDeleteSelected');
  del.disabled = n === 0;
  del.querySelector('.count').textContent = `（${n}）`;
}

function render() {
  renderProjectSelect();
  const has = Boolean(state.project);
  $('emptyState').hidden = has;
  $('btnAdd').classList.toggle('disabled', !has || state.busy);
  $('fileInput').disabled = !has;
  $('btnSettings').disabled = !has;
  $('btnDeleteProject').disabled = !has;
  if (!has) {
    $('statusBar').replaceChildren();
    $('regularList').replaceChildren();
    $('waitingList').replaceChildren();
    $('regularTitle').hidden = true;
    $('waitingTitle').hidden = true;
    updateSendButton();
    return;
  }
  const st = computeStatus(state.project, state.records);
  renderStatus(st);
  const regular = st.items.filter((i) => !i.isWaiting);
  const waiting = st.items.filter((i) => i.isWaiting);
  $('regularTitle').hidden = false;
  $('regularList').replaceChildren(...regular.map(renderCard));
  $('waitingTitle').hidden = waiting.length === 0;
  $('waitingList').replaceChildren(...waiting.map(renderCard));
  updateSendButton();
}

// photo 可以是 Blob 或 { data, type }
function openPreview(photo) {
  const dlg = $('previewDialog');
  const img = $('previewImg');
  const blob = photo instanceof Blob ? photo : new Blob([photo.data], { type: photo.type });
  const url = URL.createObjectURL(blob);
  img.src = url;
  dlg.addEventListener('close', () => {
    img.removeAttribute('src');
    URL.revokeObjectURL(url);
  }, { once: true });
  dlg.showModal();
}

function confirmCounts(prepared) {
  return new Promise((resolve) => {
    const dlg = $('confirmDialog');
    const urls = [];
    for (const p of prepared) {
      p.aiCount = p.count;
      p.count = Math.max(1, p.count ?? 1);
    }
    $('confirmList').replaceChildren(...prepared.map((p) => {
      const li = document.createElement('li');
      const url = URL.createObjectURL(new Blob([p.thumb.data], { type: p.thumb.type }));
      urls.push(url);
      li.innerHTML = `
        <img class="thumb" alt="">
        <div class="counter">
          <button type="button" class="btn-round" data-d="-1" aria-label="減一">−</button>
          <span class="count"></span>
          <button type="button" class="btn-round" data-d="1" aria-label="加一">＋</button>
        </div>
        <button type="button" class="btn-remove" aria-label="不加入這張">✕</button>`;
      li.querySelector('img').src = url;
      li.querySelector('img').addEventListener('click', () => openPreview(p.original));
      const countEl = li.querySelector('.count');
      countEl.textContent = `${p.count} 人`;
      li.querySelector('.btn-remove').addEventListener('click', () => {
        p.removed = true;
        li.remove();
        if (prepared.every((x) => x.removed)) dlg.close('cancel');
      });
      li.addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-d]');
        if (!b) return;
        p.count = Math.min(99, Math.max(1, p.count + Number(b.dataset.d)));
        countEl.textContent = `${p.count} 人`;
      });
      return li;
    }));
    $('aiNote').textContent = prepared.some((p) => p.aiCount == null)
      ? 'AI 模型還沒載入（第一次要在有網路時開啟），請手動確認人數。'
      : '備註：人與動物皆算一位，請確認後再加入。';
    const saveBtn = $('btnSaveBatch');
    saveBtn.textContent = '💾 存到相簿';
    // 分享要在 click 裡、任何 await 之前呼叫，iOS 才認定是使用者手勢
    saveBtn.onclick = async () => {
      const kept = prepared.filter((p) => !p.removed);
      if (!kept.length) return;
      const title = state.project?.title ?? '';
      const files = kept.map((p, i) => new File([p.original.data], `${safeName(title)}_${i + 1}.jpg`, { type: p.original.type }));
      const result = await shareFiles(files, title);
      if (result === 'shared') {
        kept.forEach((p) => { p.albumSaved = true; });
        saveBtn.textContent = '💾 已存相簿 ✓';
      } else if (result === 'unsupported') {
        toast('這個瀏覽器不支援分享檔案，請用 iPhone Safari');
      } else if (result === 'error') {
        toast('存相簿失敗，請再試一次');
      }
    };
    dlg.addEventListener('close', () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      saveBtn.onclick = null;
      resolve(dlg.returnValue === 'ok');
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}

async function onFilesPicked(e) {
  const files = [...e.target.files];
  e.target.value = '';
  const project = state.project;
  if (!files.length || !project) return;
  if (state.busy) {
    toast('上一批照片還在處理，請稍等');
    return;
  }
  state.busy = true;
  $('btnAdd').classList.add('disabled');
  try {
    toast(`處理 ${files.length} 張照片中…`);
    const prepared = [];
    let aiFailed = false;
    for (const file of files) {
      try {
        const { thumb, original, detectCanvas } = await prepareImage(file);
        let count = null;
        if (!aiFailed) {
          try {
            count = await detectCount(detectCanvas);
          } catch (err) {
            aiFailed = true;
            console.warn('AI 辨識失敗', err);
          }
        }
        prepared.push({ thumb, original, count });
      } catch (err) {
        console.warn(err);
        toast('有一張照片讀不到，已略過');
      }
    }
    if (!prepared.length) return;
    if (!(await confirmCounts(prepared))) return;
    const kept = prepared.filter((p) => !p.removed);
    if (!kept.length) return;
    if (state.project?.id !== project.id) {
      toast('場次已切換，這批沒有加入，請重新選照片');
      return;
    }

    let seq = state.records.reduce((m, r) => Math.max(m, r.seq), 0);
    const now = Date.now();
    const entries = kept.map((p, i) => ({
      record: {
        id: newId('rec'),
        projectId: project.id,
        seq: ++seq,
        count: p.count,
        aiCount: p.aiCount,
        isSent: false,
        sentAt: null,
        albumSaved: p.albumSaved === true,
        createdAt: now + i,
      },
      photo: { original: p.original, thumb: p.thumb },
    }));
    try {
      await db.addRecords(entries);
    } catch (err) {
      console.error(err);
      toast(`儲存失敗：${err && err.name ? err.name : err}`);
      return;
    }
    state.records.push(...entries.map((x) => x.record));
    render();
    toast(`已加入 ${entries.length} 組`);
  } finally {
    state.busy = false;
    $('btnAdd').classList.toggle('disabled', !state.project);
  }
}

async function sendRecords(ids) {
  if (!ids.length) return;
  const missing = ids.filter((id) => !state.originals.has(id));
  if (missing.length) {
    await Promise.all(missing.map(thumbUrl));
    const lost = ids.filter((id) => !state.originals.has(id));
    toast(lost.length ? `有 ${lost.length} 組照片遺失，無法傳送，請取消勾選或刪除` : '照片準備好了，請再按一次傳送');
    return;
  }
  const st = computeStatus(state.project, state.records);
  const items = ids.map((id) => st.items.find((i) => i.id === id)).filter(Boolean);
  const files = items.map((it) => {
    const blob = state.originals.get(it.id);
    return new File([blob], fileNameFor(state.project.title, it, blob.type), { type: blob.type || 'image/jpeg' });
  });
  const result = await shareFiles(files, state.project.title);
  if (result === 'shared') {
    const now = Date.now();
    const recs = items.map((it) => state.records.find((r) => r.id === it.id));
    for (const r of recs) { r.isSent = true; r.sentAt = now; }
    try {
      await db.saveRecords(recs);
      toast(`已傳 ${recs.length} 張，標為已傳送`);
    } catch (err) {
      console.error(err);
      for (const r of recs) { r.isSent = false; r.sentAt = null; }
      toast('已分享，但標記失敗，請手動按「標為已傳」');
    }
    ids.forEach((id) => state.selected.delete(id));
    render();
  } else if (result === 'unsupported') {
    toast('這個瀏覽器不支援分享檔案，請用 iPhone Safari');
  } else if (result === 'error') {
    toast('分享失敗，請再試一次');
  }
}

async function saveSelectedToAlbum() {
  const ids = [...state.selected];
  if (!ids.length) return;
  const missing = ids.filter((id) => !state.originals.has(id));
  if (missing.length) {
    await Promise.all(missing.map(thumbUrl));
    const lost = ids.filter((id) => !state.originals.has(id));
    toast(lost.length ? `有 ${lost.length} 組照片遺失，無法存相簿，請取消勾選或刪除` : '照片準備好了，請再按一次存相簿');
    return;
  }
  const st = computeStatus(state.project, state.records);
  const items = ids.map((id) => st.items.find((i) => i.id === id)).filter(Boolean);
  const files = items.map((it) => {
    const blob = state.originals.get(it.id);
    return new File([blob], fileNameFor(state.project.title, it, blob.type), { type: blob.type || 'image/jpeg' });
  });
  const result = await shareFiles(files, state.project.title);
  if (result === 'shared') {
    const recs = items.map((it) => state.records.find((r) => r.id === it.id));
    const prev = recs.map((r) => r.albumSaved);
    recs.forEach((r) => { r.albumSaved = true; });
    try {
      await db.saveRecords(recs);
      toast(`已存 ${recs.length} 張到相簿`);
    } catch (err) {
      console.error(err);
      recs.forEach((r, i) => { r.albumSaved = prev[i]; });
      toast('已分享，但標記失敗');
    }
    render();
  } else if (result === 'unsupported') {
    toast('這個瀏覽器不支援分享檔案，請用 iPhone Safari');
  } else if (result === 'error') {
    toast('存相簿失敗，請再試一次');
  }
}

async function previewCard(id) {
  if (!state.originals.has(id)) await thumbUrl(id);
  const blob = state.originals.get(id);
  if (blob) openPreview(blob);
  else toast('找不到這組照片');
}

async function onCardClick(e) {
  const thumb = e.target.closest('.card .thumb');
  if (thumb) {
    await previewCard(thumb.closest('.card').dataset.id);
    return;
  }
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('.card').dataset.id;
  const rec = state.records.find((r) => r.id === id);
  if (!rec) return;
  try {
    switch (btn.dataset.act) {
      case 'inc':
        rec.count = Math.min(99, rec.count + 1);
        await db.saveRecord(rec);
        break;
      case 'dec':
        rec.count = Math.max(1, rec.count - 1);
        await db.saveRecord(rec);
        break;
      case 'toggleSent':
        rec.isSent = !rec.isSent;
        rec.sentAt = rec.isSent ? Date.now() : null;
        await db.saveRecord(rec);
        break;
      case 'delete': {
        if (!confirm('確定刪除這一組？編號會重新計算。')) return;
        await db.deleteRecord(id);
        state.records = state.records.filter((r) => r.id !== id);
        forgetRecord(id);
        break;
      }
      case 'send':
        await sendRecords([id]);
        return;
      default:
        return;
    }
  } catch (err) {
    console.error(err);
    toast('儲存失敗，請再試一次');
    state.records = await db.listRecords(state.project.id).catch(() => state.records);
  }
  render();
}

async function showStorage() {
  const el = $('storageInfo');
  el.textContent = '';
  if (!navigator.storage?.estimate) return;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  el.textContent = `已用空間 ${(usage / 1048576).toFixed(0)} MB／可用約 ${(quota / 1073741824).toFixed(1)} GB`;
}

function fillCityTitle(dlg, input) {
  if (!navigator.geolocation) return;
  const token = {};
  fillCityTitle.token = token;
  const auto = input.value;
  navigator.geolocation.getCurrentPosition((pos) => {
    if (fillCityTitle.token !== token || !dlg.open || input.value !== auto) return;
    const city = nearestCity(pos.coords.latitude, pos.coords.longitude);
    if (city) input.value = defaultTitle(new Date(), city);
  }, () => {}, { timeout: 8000, maximumAge: 600000 });
}

function openProjectDialog(project) {
  const dlg = $('projectDialog');
  const f = $('projectForm').elements;
  $('projectDialogTitle').textContent = project ? '場次設定' : '新增場次';
  f.projectTitle.value = project?.title ?? defaultTitle(new Date());
  f.maxQuota.value = project?.maxQuota ?? 40;
  f.allowWaitingList.checked = project?.allowWaitingList ?? false;
  $('projectExtra').hidden = !project;
  if (project) showStorage();
  else fillCityTitle(dlg, f.projectTitle);
  dlg.returnValue = '';
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue !== 'ok') return;
    const data = {
      title: f.projectTitle.value.trim(),
      maxQuota: clampQuota(f.maxQuota.value),
      allowWaitingList: f.allowWaitingList.checked,
    };
    if (!data.title) return;
    if (project) {
      Object.assign(project, data);
      await db.saveProject(project);
      render();
    } else {
      const p = { id: newId('proj'), createdAt: Date.now(), ...data };
      await db.saveProject(p);
      state.projects.push(p);
      await switchProject(p.id);
    }
  }, { once: true });
  dlg.showModal();
}

async function deleteCurrentProject() {
  const p = state.project;
  if (!p) return;
  if (!confirm(`確定刪除「${p.title}」和裡面全部 ${state.records.length} 組？刪了不能復原。`)) return;
  await db.deleteProject(p.id);
  state.projects = state.projects.filter((x) => x.id !== p.id);
  await switchProject(state.projects[0]?.id ?? null);
  toast('已刪除場次');
}

async function deleteSelected() {
  const ids = [...state.selected];
  if (!ids.length) return;
  if (!confirm(`確定刪除勾選的 ${ids.length} 組？編號會重新計算。`)) return;
  try {
    await db.deleteRecords(ids);
  } catch (err) {
    console.error(err);
    toast(`刪除失敗：${err && err.name ? err.name : err}`);
    return;
  }
  const gone = new Set(ids);
  state.records = state.records.filter((r) => !gone.has(r.id));
  ids.forEach(forgetRecord);
  render();
}

async function exportCsv() {
  const p = state.project;
  if (!p) return;
  const csv = toCsv(computeStatus(p, state.records));
  const name = `${safeName(p.title)}_名單.csv`;
  const file = new File([csv], name, { type: 'text/csv' });
  const result = await shareFiles([file], name);
  if (result === 'unsupported') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}

function bindEvents() {
  document.querySelectorAll('dialog [data-close]').forEach((b) => {
    b.addEventListener('click', () => b.closest('dialog').close('cancel'));
  });
  $('projectSelect').addEventListener('change', (e) => switchProject(e.target.value));
  $('btnNewProject').addEventListener('click', () => openProjectDialog(null));
  $('btnSettings').addEventListener('click', () => openProjectDialog(state.project));
  $('fileInput').addEventListener('change', onFilesPicked);
  $('btnSendSelected').addEventListener('click', () => sendRecords([...state.selected]));
  $('btnSaveSelected').addEventListener('click', saveSelectedToAlbum);
  $('btnDeleteSelected').addEventListener('click', deleteSelected);
  $('btnExportCsv').addEventListener('click', exportCsv);
  $('btnDeleteProject').addEventListener('click', deleteCurrentProject);
  $('previewImg').addEventListener('click', () => $('previewDialog').close());
  const main = $('main');
  main.addEventListener('click', onCardClick);
  main.addEventListener('change', (e) => {
    if (!e.target.classList.contains('pick-box')) return;
    const id = e.target.closest('.card').dataset.id;
    if (e.target.checked) state.selected.add(id);
    else state.selected.delete(id);
    updateSendButton();
  });
}

async function init() {
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker 註冊失敗', e));
  }
  bindEvents();
  state.projects = await db.listProjects();
  const active = readActive();
  await switchProject(state.projects.find((p) => p.id === active)?.id ?? state.projects[0]?.id ?? null);
  const warmUp = () => loadModel().catch((e) => console.warn('AI 模型載入失敗', e));
  if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(warmUp);
  else warmUp();
}

setupGate(init);
