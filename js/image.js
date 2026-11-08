function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('圖片無法讀取')); };
    img.src = url;
  });
}

function drawScaled(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toJpegData(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('圖片轉檔失敗')); return; }
      blob.arrayBuffer().then((data) => resolve({ data, type: 'image/jpeg' }), reject);
    }, 'image/jpeg', quality);
  });
}

// 用 <img> 解碼，Safari 會套用 EXIF 方向
// 存 ArrayBuffer 而非 Blob：iOS Safari 無痕模式的 IndexedDB 存不了 Blob/File
// 原圖重新編碼會去掉 EXIF（含 GPS）；4096 避開 iOS canvas 尺寸上限
export async function prepareImage(file) {
  const img = await loadImage(file);
  const thumb = await toJpegData(drawScaled(img, 400), 0.8);
  const original = await toJpegData(drawScaled(img, 4096), 0.92);
  const detectCanvas = drawScaled(img, 640);
  return { thumb, original, detectCanvas };
}
