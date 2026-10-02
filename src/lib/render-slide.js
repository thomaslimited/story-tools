// Draws one story image (slide) onto a 2D canvas: frames, borders (multi-frame only) and speech bubbles.
// Used by the editor, the story preview and export, so what you see is exactly what gets exported.
import { autoPlaceBubbles } from './bubbles.js';
import { PAGE_SIZES, computeCells, getLayout } from './layouts.js';

export const FONT_FAMILY = '"Be Vietnam Pro", "Noto Sans", Arial, sans-serif';
const PAPER = '#efe3c8';
const INK = '#2b1d12';

/** Draws an image scaled to fully cover the rect (center crop). */
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawPlaceholder(ctx, cell, label) {
  ctx.fillStyle = '#d9ccb0';
  ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
  ctx.fillStyle = '#8a7a5e';
  ctx.font = `600 ${Math.round(Math.min(cell.w, cell.h) * 0.07)}px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cell.x + cell.w / 2, cell.y + cell.h / 2);
}

/** Greedy word wrap using real font metrics. */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Computes the bubble box (image coordinates) from normalized bubble data. */
function measureBubble(ctx, bubble, cell) {
  const fontSize = bubble.fontSize || 34;
  ctx.font = `500 ${fontSize}px ${FONT_FAMILY}`;
  const pad = fontSize * 0.7;
  const maxTextW = Math.max(fontSize * 3, bubble.w * cell.w - pad * 2);
  const lines = wrapText(ctx, bubble.text || ' ', maxTextW);
  const lineH = fontSize * 1.28;
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxW = textW + pad * 2;
  const boxH = lines.length * lineH + pad * 1.6;
  const cx = cell.x + bubble.cx * cell.w;
  const cy = cell.y + bubble.cy * cell.h;
  return {
    x: cx - boxW / 2,
    y: cy - boxH / 2,
    w: boxW,
    h: boxH,
    lines,
    lineH,
    fontSize,
    tail: { x: cell.x + bubble.tx * cell.w, y: cell.y + bubble.ty * cell.h },
  };
}

function bubblePath(ctx, box) {
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, Math.min(box.h / 2, box.w / 2, box.fontSize * 1.6));
}

function tailPath(ctx, box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = box.tail.x - cx;
  const dy = box.tail.y - cy;
  const len = Math.hypot(dx, dy) || 1;
  // Tail base is perpendicular to the direction of the tip, centered in the bubble.
  const half = Math.min(box.w, box.h) * 0.16;
  const px = (-dy / len) * half;
  const py = (dx / len) * half;
  ctx.beginPath();
  ctx.moveTo(cx + px, cy + py);
  ctx.lineTo(box.tail.x, box.tail.y);
  ctx.lineTo(cx - px, cy - py);
  ctx.closePath();
}

function drawBubble(ctx, box) {
  const stroke = Math.max(2, box.fontSize * 0.09);
  const hasTail = Math.hypot(box.tail.x - (box.x + box.w / 2), box.tail.y - (box.y + box.h / 2)) > box.h * 0.6;

  // Union outline trick: stroke both shapes at 2x width, then fill both; the fill hides inner strokes.
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke * 2;
  ctx.strokeStyle = INK;
  if (hasTail) {
    tailPath(ctx, box);
    ctx.stroke();
  }
  bubblePath(ctx, box);
  ctx.stroke();

  ctx.fillStyle = '#fffdf7';
  if (hasTail) {
    tailPath(ctx, box);
    ctx.fill();
  }
  bubblePath(ctx, box);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${box.fontSize}px ${FONT_FAMILY}`;
  const startY = box.y + box.h / 2 - ((box.lines.length - 1) * box.lineH) / 2;
  box.lines.forEach((line, i) => ctx.fillText(line, box.x + box.w / 2, startY + i * box.lineH));
}

/**
 * Renders a slide and returns hit regions for interactive editing.
 * Frames whose bubbles were never placed get default placement on the fly.
 * @param {CanvasRenderingContext2D} ctx context sized to the image resolution
 * @param {{project, slide, images: Map<string, HTMLImageElement>, selection?: {frameId, bubbleId}}} options
 */
export function renderSlide(ctx, { project, slide, images, selection }) {
  const page = PAGE_SIZES[project.orientation] || PAGE_SIZES.portrait;
  const cells = computeCells(project.orientation, getLayout(project.orientation, slide.layoutId));
  const multi = cells.length > 1;
  const hits = [];

  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, page.w, page.h);

  slide.frames.forEach((frame, i) => {
    const cell = cells[i];
    if (!cell) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(cell.x, cell.y, cell.w, cell.h);
    ctx.clip();
    const img = frame.selectedImage && images.get(frame.selectedImage);
    if (img) drawCover(ctx, img, cell.x, cell.y, cell.w, cell.h);
    else drawPlaceholder(ctx, cell, multi ? `Khung ${i + 1} – chưa có ảnh` : 'Chưa có ảnh');

    const bubbles = frame.bubbles ?? autoPlaceBubbles(frame, { cellAspect: cell.w / cell.h, frameCount: cells.length });
    for (const bubble of bubbles) {
      const box = measureBubble(ctx, bubble, cell);
      drawBubble(ctx, box);
      hits.push({ frameId: frame.id, bubbleId: bubble.id, cell, box });
    }
    ctx.restore();

    if (multi) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
    }
  });

  // Selection overlay (editor only).
  const selected = selection && hits.find((h) => h.bubbleId === selection.bubbleId);
  if (selected) {
    const { box } = selected;
    ctx.setLineDash([12, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1e7bff';
    ctx.strokeRect(box.x - 8, box.y - 8, box.w + 16, box.h + 16);
    ctx.setLineDash([]);
    ctx.fillStyle = '#1e7bff';
    ctx.beginPath();
    ctx.arc(box.tail.x, box.tail.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(box.x + box.w + 8 - 10, box.y + box.h / 2 - 10, 20, 20);
  }
  ctx.restore();

  return { cells, hits };
}
