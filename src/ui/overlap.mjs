export function intersectionArea(a, b) {
  const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

function related(a, b) {
  return a.ancestors.includes(b.id) || b.ancestors.includes(a.id);
}

const BAD_PAIRS = new Set([
  'bar-canvas',
  'bar-chrome',
  'bar-overlay',
  'canvas-canvas',
  'canvas-chrome',
  'chrome-chrome',
  'overlay-overlay',
  'bar-modal',
]);

export function findOverlaps(items, { minArea = 64 } = {}) {
  const hits = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (related(a, b)) continue;
      if (a.role && b.role && !BAD_PAIRS.has([a.role, b.role].sort().join('-'))) continue;
      const area = intersectionArea(a, b);
      if (area < minArea) continue;
      hits.push({
        a: a.name,
        b: b.name,
        area: Math.round(area),
      });
    }
  }
  return hits;
}

export function findLabelHits(labels, shapes, { minArea = 48 } = {}) {
  const hits = [];
  for (const label of labels) {
    for (const shape of shapes) {
      if (related(label, shape)) continue;
      const area = intersectionArea(label, shape);
      if (area < minArea) continue;
      const cover = area / Math.max(1, label.w * label.h);
      if (cover < 0.2) continue;
      hits.push({
        a: label.name,
        b: shape.name,
        area: Math.round(area),
      });
    }
  }
  return hits;
}

export function findOverflows(items) {
  return items.filter((item) => item.overflow && item.clientWidth > 0 && item.scrollWidth > item.clientWidth + 1);
}
