const COUNT_CLASSES = new Set(['person', 'dog', 'cat']);
const MIN_SCORE = 0.5;
const MODEL_PATH = 'vendor/model/ssdlite_mobilenet_v2/model.json';
let modelPromise = null;

export function countSubjects(predictions) {
  return predictions.filter((p) => COUNT_CLASSES.has(p.class) && p.score >= MIN_SCORE).length;
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

export function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      if (!globalThis.tf) await loadScript('vendor/tf.min.js');
      if (!globalThis.cocoSsd) await loadScript('vendor/coco-ssd.min.js');
      await globalThis.tf.ready();
      return globalThis.cocoSsd.load({
        base: 'lite_mobilenet_v2',
        modelUrl: new URL(MODEL_PATH, location.href).href,
      });
    })().catch((e) => {
      modelPromise = null;
      throw e;
    });
  }
  return modelPromise;
}

export async function detectCount(canvas) {
  const model = await loadModel();
  const predictions = await model.detect(canvas, 30, MIN_SCORE);
  return countSubjects(predictions);
}
