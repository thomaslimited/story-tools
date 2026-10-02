// Speech bubble data helpers. Positions are normalized to the frame cell (0..1) so they survive layout changes.
import { uid } from './story-model.js';

/**
 * Initial bubble placement: speakers listed first in the frame go left, others right; multiple lines stack downward.
 * Sizes and tail length adapt to the cell shape so tall full-bleed images don't get huge tails.
 */
export function autoPlaceBubbles(frame, { cellAspect, frameCount }) {
  const dialogues = (frame.dialogues || []).filter((d) => d.text?.trim());
  const order = frame.characterIds || [];
  const fontSize = frameCount === 1 ? 42 : 34;
  const w = cellAspect < 1 ? 0.6 : 0.36;
  const tailDy = Math.min(0.22, 0.12 * cellAspect + 0.05);
  const step = Math.min(0.2, tailDy * 0.9 + 0.04);
  const top = Math.min(0.16, 0.06 + 0.05 * cellAspect);

  return dialogues.map((d, i) => {
    const speakerIndex = order.indexOf(d.speakerId);
    const left = speakerIndex >= 0 ? speakerIndex % 2 === 0 : i % 2 === 0;
    const cx = left ? w / 2 + 0.05 : 1 - w / 2 - 0.05;
    const cy = Math.min(top + i * step, 0.8);
    return {
      id: uid(),
      text: d.text.trim(),
      cx,
      cy,
      w,
      fontSize,
      tx: left ? cx - 0.08 : cx + 0.06,
      ty: Math.min(cy + tailDy, 0.95),
    };
  });
}

/** Maps a point normalized to the source image into cell coordinates, matching the renderer's cover crop. */
export function imageToCell(nx, ny, img, cell) {
  const scale = Math.max(cell.w / img.width, cell.h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  return { x: ((cell.w - dw) / 2 + nx * dw) / cell.w, y: ((cell.h - dh) / 2 + ny * dh) / cell.h };
}

export const createBubble = (fontSize = 34) => ({
  id: uid(),
  text: 'Lời thoại',
  cx: 0.5,
  cy: 0.2,
  w: 0.4,
  fontSize,
  tx: 0.45,
  ty: 0.35,
});
