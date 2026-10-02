// Frame image generation and AI bubble placement, shared by the manual steps and the story automation.
import { api, panelImageUrl } from '../api.js';
import { autoPlaceBubbles, imageToCell } from './bubbles.js';
import { loadImage } from './image-cache.js';
import { computeCells, getLayout } from './layouts.js';
import { buildFramePrompt } from './prompt-builder.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Generates one frame image. `entry` comes from frameEntries(); `styleRefImage` is the previous frame's image,
 * only sent when the project enables it.
 * @returns {Promise<{file: string, prompt: string}>}
 */
export async function generateFrameImage(project, entry, characters, styleRefImage) {
  const { slide, frame, aspectRatio } = entry;
  const prompt = frame.prompt?.trim() || buildFramePrompt(project, slide, frame, characters);
  const { file } = await api.generateImage(project.id, {
    prompt,
    characterIds: frame.characterIds,
    aspectRatio,
    styleRefImage: project.usePrevFrameRef ? styleRefImage || null : null,
  });
  return { file, prompt };
}

/**
 * Asks Gemini to look at the frame image and place a bubble per dialogue line (and reword it to fit the picture).
 * Returns { bubbles, dialogues } ready for updateFrame, or null when the frame has no image or no dialogue.
 */
export async function placeBubblesFromImage(project, entry, characters, file = entry.frame.selectedImage) {
  const { slide, frame, f } = entry;
  const spoken = frame.dialogues.filter((d) => d.text?.trim());
  if (!file || !spoken.length) return null;

  const cells = computeCells(project.orientation, getLayout(project.orientation, slide.layoutId));
  const cell = cells[f];
  const nameOf = (id) => characters.find((c) => c.id === id)?.name || '';
  const [img, result] = await Promise.all([
    loadImage(panelImageUrl(project.id, file)),
    api.placeBubbles(project.id, {
      image: file,
      scene: frame.scene,
      action: frame.action,
      dialogues: spoken.map((d) => ({ speaker: nameOf(d.speakerId), text: d.text.trim() })),
      characters: characters.filter((c) => frame.characterIds.includes(c.id)).map((c) => ({ name: c.name, description: c.description })),
    }),
  ]);

  // Template placement supplies size/font defaults and covers any line the model skipped.
  const defaults = autoPlaceBubbles(frame, { cellAspect: cell.w / cell.h, frameCount: cells.length });
  const bubbles = defaults.map((base, i) => {
    const r = result.bubbles.find((b) => b.index === i);
    if (!r) return base;
    const center = imageToCell(r.bubbleX, r.bubbleY, img, cell);
    const speaker = imageToCell(r.speakerX, r.speakerY, img, cell);
    const cx = clamp(center.x, base.w / 2 + 0.02, 1 - base.w / 2 - 0.02);
    const cy = clamp(center.y, 0.06, 0.94);
    // Tail points toward the speaker but stops short of the face, capped so it never spans the whole frame.
    const dx = (speaker.x - cx) * cell.w;
    const dy = (speaker.y - cy) * cell.h;
    const dist = Math.hypot(dx, dy) || 1;
    const len = Math.min(dist * 0.7, Math.min(cell.w, cell.h) * 0.3);
    return {
      ...base,
      text: r.text.trim() || base.text,
      cx,
      cy,
      tx: clamp(cx + ((dx / dist) * len) / cell.w, 0, 1),
      ty: clamp(cy + ((dy / dist) * len) / cell.h, 0, 1),
    };
  });

  // Keep the script in sync with the wording adjusted for the picture.
  let k = 0;
  const dialogues = frame.dialogues.map((d) => (d.text?.trim() ? { ...d, text: bubbles[k++].text } : d));
  return { bubbles, dialogues };
}
