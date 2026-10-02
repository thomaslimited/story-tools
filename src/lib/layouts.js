// Image sizes and frame layout templates. Each layout is a list of rows; each number is the column count in that row.

export const PAGE_SIZES = {
  portrait: { w: 1080, h: 1920, label: 'Dọc 9:16 (TikTok/Shorts)' },
  landscape: { w: 1920, h: 1080, label: 'Ngang 16:9 (YouTube)' },
};

export const LAYOUTS = {
  portrait: [
    { id: 'p1', label: '1 khung (tràn ảnh)', rows: [1] },
    { id: 'p2', label: '2 khung dọc', rows: [1, 1] },
    { id: 'p3', label: '3 khung dọc', rows: [1, 1, 1] },
    { id: 'p4', label: '4 khung dọc', rows: [1, 1, 1, 1] },
    { id: 'p4g', label: '4 khung lưới 2×2', rows: [2, 2] },
    { id: 'p6', label: '6 khung lưới 2×3', rows: [2, 2, 2] },
  ],
  landscape: [
    { id: 'l1', label: '1 khung (tràn ảnh)', rows: [1] },
    { id: 'l2', label: '2 khung ngang', rows: [2] },
    { id: 'l3', label: '3 khung ngang', rows: [3] },
    { id: 'l4', label: '4 khung lưới 2×2', rows: [2, 2] },
    { id: 'l6', label: '6 khung lưới 3×2', rows: [3, 3] },
  ],
};

export const PAGE_MARGIN = 28;
export const FRAME_GUTTER = 24;

export function getLayout(orientation, layoutId) {
  const list = LAYOUTS[orientation] || LAYOUTS.portrait;
  return list.find((l) => l.id === layoutId) || list[0];
}

export const framesPerLayout = (layout) => layout.rows.reduce((sum, cols) => sum + cols, 0);

/** Returns cell rectangles (image pixel coordinates) in reading order. */
export function computeCells(orientation, layout) {
  const page = PAGE_SIZES[orientation] || PAGE_SIZES.portrait;
  // A single-frame image is full-bleed: no margin, gutter or border.
  if (framesPerLayout(layout) === 1) return [{ x: 0, y: 0, w: page.w, h: page.h }];

  const rowCount = layout.rows.length;
  const rowH = (page.h - PAGE_MARGIN * 2 - FRAME_GUTTER * (rowCount - 1)) / rowCount;
  const cells = [];
  layout.rows.forEach((cols, r) => {
    const cellW = (page.w - PAGE_MARGIN * 2 - FRAME_GUTTER * (cols - 1)) / cols;
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: PAGE_MARGIN + c * (cellW + FRAME_GUTTER),
        y: PAGE_MARGIN + r * (rowH + FRAME_GUTTER),
        w: cellW,
        h: rowH,
      });
    }
  });
  return cells;
}

// Aspect ratios accepted by Gemini image models.
const SUPPORTED_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

/** Closest supported aspect ratio for a w×h cell; the image is cover-cropped into the cell. */
export function closestAspectRatio(w, h) {
  const target = Math.log(w / h);
  let best = SUPPORTED_RATIOS[0];
  let bestDiff = Infinity;
  for (const ratio of SUPPORTED_RATIOS) {
    const [rw, rh] = ratio.split(':').map(Number);
    const diff = Math.abs(Math.log(rw / rh) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ratio;
    }
  }
  return best;
}

/** Aspect ratio to request for a frame, based on the cell it occupies in its image layout. */
export function aspectRatioForFrame(orientation, layout, frameIndex) {
  const cells = computeCells(orientation, layout);
  const cell = cells[frameIndex] || cells[0];
  return closestAspectRatio(cell.w, cell.h);
}
