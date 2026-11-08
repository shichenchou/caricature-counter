import { pad2 } from './csv.js';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp' };

export function safeName(text) {
  return String(text).trim().replace(/[\\/:*?"<>|\s]+/g, '-');
}

export function fileNameFor(projectTitle, item, mimeType) {
  const tag = item.isWaiting ? `備${item.no}` : pad2(item.no);
  return `${safeName(projectTitle)}_${tag}_${item.count}人.${EXT[mimeType] ?? 'jpg'}`;
}

// 呼叫端在 await 任何東西之前就要呼叫，iOS 的分享需要「剛按下按鈕」的使用者手勢
export async function shareFiles(files, title, nav = globalThis.navigator) {
  if (!nav || typeof nav.canShare !== 'function' || typeof nav.share !== 'function' || !nav.canShare({ files })) {
    return 'unsupported';
  }
  try {
    await nav.share({ files, title });
    return 'shared';
  } catch (e) {
    return e && e.name === 'AbortError' ? 'cancelled' : 'error';
  }
}
