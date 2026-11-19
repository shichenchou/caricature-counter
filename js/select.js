export function selectAll(items) {
  return new Set(items.map((i) => i.id));
}

export function selectNone() {
  return new Set();
}

export function invert(items, selected) {
  return new Set(items.filter((i) => !selected.has(i.id)).map((i) => i.id));
}

export function selectUnsent(items) {
  return new Set(items.filter((i) => !i.isSent).map((i) => i.id));
}

export function selectUnsynced(items) {
  return new Set(items.filter((i) => i.albumSaved !== true).map((i) => i.id));
}
