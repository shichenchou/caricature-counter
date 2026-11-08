export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatTime(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function csvCell(value) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(status) {
  const head = ['編號', '正備取', '人數', '加入時間', '已傳給老師', '傳送時間'];
  const rows = status.items.map((i) => [
    i.isWaiting ? `備${i.no}` : `#${pad2(i.no)}`,
    i.isWaiting ? '備取' : '正取',
    i.count,
    formatTime(i.createdAt),
    i.isSent ? '是' : '否',
    i.sentAt ? formatTime(i.sentAt) : '',
  ]);
  // BOM 讓 Excel / Numbers 正確辨識 UTF-8 中文
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
