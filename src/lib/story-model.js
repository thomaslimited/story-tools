// Story data model: project -> slides (published images) -> frames (one generated picture each).
import { LAYOUTS, aspectRatioForFrame, framesPerLayout, getLayout } from './layouts.js';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const createFrame = (patch = {}) => ({
  id: uid(),
  scene: '',
  action: '',
  expression: '',
  characterIds: [],
  dialogues: [],
  prompt: '',
  images: [],
  selectedImage: null,
  bubbles: null,
  ...patch,
});

export function createSlide(orientation, layoutId) {
  const layout = getLayout(orientation, layoutId);
  return { id: uid(), idea: '', layoutId: layout.id, frames: fitFrames([], layout) };
}

const LAYOUT_BY_COUNT = {
  portrait: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 6: 'p6' },
  landscape: { 1: 'l1', 2: 'l2', 3: 'l3', 4: 'l4', 6: 'l6' },
};

/** Default layout for a slide with `count` frames (stacked rows in portrait, side by side in landscape). */
export const layoutForFrameCount = (orientation, count) => getLayout(orientation, LAYOUT_BY_COUNT[orientation]?.[count]);

export const hasFrameContent = (f) =>
  Boolean(f.scene || f.action || f.expression || f.prompt || f.dialogues?.length || f.images?.length);

/** Frames resized to the layout capacity: pads with empty frames or drops trailing ones. */
export function fitFrames(frames, layout) {
  const n = framesPerLayout(layout);
  if (frames.length >= n) return frames.slice(0, n);
  return [...frames, ...Array.from({ length: n - frames.length }, () => createFrame())];
}

/** Switching orientation keeps each slide's frame count where the other orientation has such a layout. */
export function switchOrientation(project, orientation) {
  return {
    orientation,
    slides: project.slides.map((s) => {
      const count = framesPerLayout(getLayout(project.orientation, s.layoutId));
      const next = LAYOUTS[orientation].find((l) => framesPerLayout(l) === count) || LAYOUTS[orientation][0];
      return { ...s, layoutId: next.id, frames: fitFrames(s.frames, next) };
    }),
  };
}

/** Every frame in story order with its slide, positions and requested aspect ratio. */
export function frameEntries(project) {
  return project.slides.flatMap((slide, s) => {
    const layout = getLayout(project.orientation, slide.layoutId);
    return slide.frames.map((frame, f) => ({
      slide,
      frame,
      s,
      f,
      frameCount: slide.frames.length,
      aspectRatio: aspectRatioForFrame(project.orientation, layout, f),
    }));
  });
}

export const frameLabel = (s, f, frameCount) => (frameCount > 1 ? `Ảnh ${s + 1} · Khung ${f + 1}` : `Ảnh ${s + 1}`);

/** Upgrades projects saved with the older flat `panels` + single page layout shape. */
// Prompts saved while frames had a clock field asked the model to draw a wall clock; strip that request.
const CLOCK_PROMPT_LINE = /^A round wooden wall clock .*(?:\r?\n|$)/gm;
const CLOCK_TEXT_RULE = 'IMPORTANT: apart from the time on the clock, do NOT draw any text, letters,';
const NO_TEXT_RULE = 'IMPORTANT: do NOT draw any text, letters, numbers,';

function dropClock({ clock: _clock, ...frame }) {
  return { ...frame, prompt: (frame.prompt || '').replace(CLOCK_PROMPT_LINE, '').replace(CLOCK_TEXT_RULE, NO_TEXT_RULE) };
}

export function migrateProject(project) {
  const { panels, layoutId, showClock: _showClock, usePrevPanelRef, ...rest } = project;
  const usePrevFrameRef = rest.usePrevFrameRef ?? usePrevPanelRef ?? true;

  let slides = rest.slides;
  if (!Array.isArray(slides)) {
    const layout = getLayout(project.orientation, layoutId);
    const size = framesPerLayout(layout);
    slides = [];
    for (let i = 0; i < (panels || []).length; i += size) {
      slides.push({ id: uid(), idea: '', layoutId: layout.id, frames: fitFrames(panels.slice(i, i + size), layout) });
    }
  }
  return { ...rest, usePrevFrameRef, slides: slides.map((s) => ({ ...s, frames: s.frames.map(dropClock) })) };
}
