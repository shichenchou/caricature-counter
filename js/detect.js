const COUNT_CLASSES = new Set(['person', 'dog', 'cat']);
const PET_CLASSES = new Set(['dog', 'cat']);
const MIN_SCORE = 0.5;
// 沒有臉的人框常是誤判（例如身體下半段被框成另一人），門檻拉高
const FACELESS_MIN_SCORE = 0.7;
const MODEL_PATH = 'vendor/model/ssdlite_mobilenet_v2/model.json';
const FACE_MODEL_PATH = 'vendor/model/blazeface/model.json';
let tfPromise = null;
let modelPromise = null;
let facePromise = null;

export function countSubjects(predictions) {
  return predictions.filter((p) => COUNT_CLASSES.has(p.class) && p.score >= MIN_SCORE).length;
}

function contains([x, y, w, h], [cx, cy]) {
  return cx >= x && cx <= x + w && cy >= y && cy <= y + h;
}

// predictions：COCO-SSD 結果（bbox = [x, y, w, h]）；faces：BlazeFace 結果（topLeft / bottomRight = [x, y]）
// 「有臉」= 至少一張臉中心落在框內（不管那張臉最後配給哪個框）；沒臉的人框分數要 ≥ FACELESS_MIN_SCORE 才算
// 一個人框最多配一張臉。臉中心落在已被配走的人框裡仍算多一人：同一框兩張臉通常是兩人重疊被框成一個
// 但沒配到人框、中心落在狗貓框裡的臉不加人：那是狗貓的臉，狗貓框已經算過
export function mergeCount(predictions, faces) {
  const kept = predictions.filter((p) => p.score >= MIN_SCORE);
  const petBoxes = kept.filter((p) => PET_CLASSES.has(p.class)).map((p) => p.bbox);
  const centers = faces.map((f) => [(f.topLeft[0] + f.bottomRight[0]) / 2, (f.topLeft[1] + f.bottomRight[1]) / 2]);
  const persons = kept
    .filter((p) => p.class === 'person')
    .filter((p) => p.score >= FACELESS_MIN_SCORE || centers.some((c) => contains(p.bbox, c)))
    .map((p) => ({ bbox: p.bbox, area: p.bbox[2] * p.bbox[3], claimed: false }));
  const withHits = centers.map((c) => ({ c, hits: persons.filter((p) => contains(p.bbox, c)) }));
  // 可配人框少的臉先配，避免它唯一的框被別張臉搶走
  withHits.sort((a, b) => a.hits.length - b.hits.length);
  let extraFaces = 0;
  for (const { c, hits } of withHits) {
    const free = hits.filter((p) => !p.claimed).sort((a, b) => a.area - b.area);
    if (free.length) free[0].claimed = true;
    else if (!petBoxes.some((b) => contains(b, c))) extraFaces += 1;
  }
  return persons.length + petBoxes.length + extraFaces;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`載入失敗：${src}`));
    document.head.append(s);
  });
}

function loadTf() {
  if (!tfPromise) {
    tfPromise = (async () => {
      if (!globalThis.tf) await loadScript('vendor/tf.min.js');
      await globalThis.tf.ready();
    })().catch((e) => {
      tfPromise = null;
      throw e;
    });
  }
  return tfPromise;
}

// 臉模型只是輔助：失敗回 null（退回只用 COCO-SSD），且不記住失敗，下次辨識再重試
export function loadFaceModel() {
  if (!facePromise) {
    facePromise = (async () => {
      await loadTf();
      if (!globalThis.blazeface) await loadScript('vendor/blazeface.min.js');
      return globalThis.blazeface.load({
        modelUrl: new URL(FACE_MODEL_PATH, location.href).href,
        maxFaces: 30,
      });
    })().catch((e) => {
      facePromise = null;
      console.warn('臉部模型載入失敗，改用人形辨識', e);
      return null;
    });
  }
  return facePromise;
}

export function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      await loadTf();
      if (!globalThis.cocoSsd) await loadScript('vendor/coco-ssd.min.js');
      return globalThis.cocoSsd.load({
        base: 'lite_mobilenet_v2',
        modelUrl: new URL(MODEL_PATH, location.href).href,
      });
    })().catch((e) => {
      modelPromise = null;
      throw e;
    });
    loadFaceModel();
  }
  return modelPromise;
}

export async function detectCount(canvas) {
  const [coco, face] = await Promise.all([loadModel(), loadFaceModel()]);
  const [predictions, faces] = await Promise.all([
    coco.detect(canvas, 30, MIN_SCORE),
    face?.estimateFaces(canvas, false).catch((e) => {
      console.warn('臉部辨識失敗，改用人形辨識', e);
      return null;
    }),
  ]);
  return faces ? mergeCount(predictions, faces) : countSubjects(predictions);
}
