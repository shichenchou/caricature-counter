export function clampQuota(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function computeStatus(project, records) {
  const max = project.maxQuota;
  const sorted = [...records].sort((a, b) => a.seq - b.seq);
  let regularCount = 0;
  let waitingCount = 0;
  let regularNo = 0;
  let waitingNo = 0;
  let sentPhotos = 0;
  let unsentPeople = 0;
  let unsentPhotos = 0;

  const items = sorted.map((r) => {
    // 整組判定：這組加入前正取還沒滿就整組正取（允許彈性超額）
    const isWaiting = project.allowWaitingList && regularCount >= max;
    let no;
    if (isWaiting) {
      no = ++waitingNo;
      waitingCount += r.count;
    } else {
      no = ++regularNo;
      regularCount += r.count;
    }
    if (r.isSent) sentPhotos++;
    else {
      unsentPeople += r.count;
      unsentPhotos++;
    }
    return { ...r, isWaiting, no };
  });

  let state;
  if (project.allowWaitingList && regularCount >= max) state = 'waiting';
  else if (regularCount > max) state = 'over';
  else if (regularCount === max) state = 'full';
  else state = 'open';

  return {
    items,
    regularCount,
    waitingCount,
    total: regularCount + waitingCount,
    remaining: max - regularCount,
    sentPhotos,
    unsentPeople,
    unsentPhotos,
    state,
  };
}
