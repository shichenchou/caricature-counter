const DECODE_TIMEOUT = 15000;
const ENCODE_TIMEOUT = 15000;

// promise 在 ms 內沒結果就 reject；iOS 記憶體吃緊時 toBlob / 圖片解碼可能永遠不回呼
export function withTimeout(promise, ms, msg) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(msg)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// iOS canvas 記憶體總量有上限（約 384MB），用完要歸零才會馬上釋放
export function releaseCanvas(canvas) {
  if (canvas) canvas.width = canvas.height = 0;
}

function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  const loaded = new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('圖片無法讀取'));
    img.src = url;
  });
  return withTimeout(loaded, DECODE_TIMEOUT, '圖片讀取逾時').finally(() => URL.revokeObjectURL(url));
}

function drawScaled(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    releaseCanvas(canvas);
    throw new Error('canvas 記憶體不足');
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('圖片轉檔失敗'));
    }, 'image/jpeg', quality);
  });
}

async function toJpegData(canvas, quality) {
  try {
    const blob = await withTimeout(toBlob(canvas, quality), ENCODE_TIMEOUT, '圖片轉檔逾時');
    return { data: await blob.arrayBuffer(), type: 'image/jpeg' };
  } finally {
    releaseCanvas(canvas);
  }
}

// 用 <img> 解碼，Safari 會套用 EXIF 方向
// 存 ArrayBuffer 而非 Blob：iOS Safari 無痕模式的 IndexedDB 存不了 Blob/File
// 原圖重新編碼會去掉 EXIF（含 GPS）；4096 避開 iOS canvas 尺寸上限
// detectCanvas 由呼叫端辨識完自己 releaseCanvas
export async function prepareImage(file) {
  const img = await loadImage(file);
  const thumb = await toJpegData(drawScaled(img, 400), 0.8);
  const original = await toJpegData(drawScaled(img, 4096), 0.92);
  const detectCanvas = drawScaled(img, 640);
  return { thumb, original, detectCanvas };
}
