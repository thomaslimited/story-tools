// Local API server: storage for characters/projects, Gemini frame writing + image generation, static image files.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import * as store from './storage.js';
import { generateCaption, generateFrames, generateImage, generateStoryPlan, listModels, placeBubbles } from './gemini.js';
import { shareStatus, startShare, stopShare } from './lan-share.js';

const PORT = Number(process.env.PORT) || 5174;
const DIST_DIR = path.resolve(store.DATA_DIR, '..', 'dist');
const DEFAULT_STYLE =
  'Warm hand-drawn anime illustration in the style of Studio Ghibli, soft watercolor textures, golden warm lighting, clean line art, cozy slice-of-life mood';

// Cast for a Gemini call. Prefer ids from the request: the client autosave may not have persisted the latest cast yet.
async function castFor(project, characterIds) {
  const ids = Array.isArray(characterIds) ? characterIds : project.characterIds;
  return (await store.listCharacters()).filter((c) => ids.includes(c.id));
}

/** Converts model-written frames (character names) into stored frames (character ids). */
function toStoredFrames(frames, characters) {
  const byName = new Map(characters.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const toId = (name) => byName.get(String(name || '').trim().toLowerCase()) || null;
  return frames.map((f) => ({
    id: store.newId(),
    scene: f.scene || '',
    action: f.action || '',
    expression: f.expression || '',
    characterIds: [...new Set((f.characters || []).map(toId).filter(Boolean))],
    dialogues: (f.dialogues || []).map((d) => ({ speakerId: toId(d.speaker), text: d.text || '' })),
    prompt: '',
    images: [],
    selectedImage: null,
    bubbles: null,
  }));
}

const app = express();
app.use(express.json({ limit: '10mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ---- settings ----
app.get('/api/settings', async (_req, res) => {
  const { apiKey, textModel, imageModel } = await store.getSettings();
  res.json({ hasApiKey: Boolean(apiKey), apiKeyHint: apiKey ? `…${apiKey.slice(-4)}` : '', textModel, imageModel });
});

app.put('/api/settings', async (req, res) => {
  const { apiKey, textModel, imageModel } = req.body || {};
  const patch = {};
  if (typeof apiKey === 'string' && apiKey.trim()) patch.apiKey = apiKey.trim();
  if (typeof textModel === 'string' && textModel.trim()) patch.textModel = textModel.trim();
  if (typeof imageModel === 'string' && imageModel.trim()) patch.imageModel = imageModel.trim();
  await store.saveSettings(patch);
  res.json({ ok: true });
});

app.get('/api/models', async (_req, res) => res.json(await listModels(await store.getSettings())));

// ---- characters ----
app.get('/api/characters', async (_req, res) => res.json(await store.listCharacters()));

app.put('/api/characters', async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Dữ liệu nhân vật phải là mảng' });
  await store.saveCharacters(req.body);
  res.json({ ok: true });
});

app.post('/api/characters/images', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
  const file = await store.saveImage(store.CHARACTER_IMAGE_DIR, req.file.buffer, req.file.mimetype);
  res.json({ file });
});

// ---- projects ----
app.get('/api/projects', async (_req, res) => res.json(await store.listProjects()));

app.post('/api/projects', async (req, res) => {
  const project = await store.saveProject({
    id: store.newId(),
    title: req.body?.title?.trim() || 'Truyện mới',
    orientation: req.body?.orientation === 'landscape' ? 'landscape' : 'portrait',
    style: DEFAULT_STYLE,
    idea: '',
    characterIds: [],
    usePrevFrameRef: true,
    slides: [],
    createdAt: new Date().toISOString(),
  });
  res.json(project);
});

app.get('/api/projects/:id', async (req, res) => res.json(await store.getProject(req.params.id)));

app.put('/api/projects/:id', async (req, res) => {
  if (req.body?.id !== req.params.id) return res.status(400).json({ error: 'Sai id truyện' });
  res.json(await store.saveProject(req.body));
});

app.delete('/api/projects/:id', async (req, res) => {
  await store.deleteProject(req.params.id);
  res.json({ ok: true });
});

// Writes the frames for one story image. The client owns the project state and merges the result.
app.post('/api/projects/:id/slides/script', async (req, res) => {
  const project = await store.getProject(req.params.id);
  const { storyIdea = '', slideIdeas, slideIndex, frameCount, characterIds } = req.body || {};
  if (!Array.isArray(slideIdeas) || !slideIdeas[slideIndex]?.trim()) {
    return res.status(400).json({ error: 'Hãy nhập ý tưởng cho ảnh này' });
  }

  const characters = await castFor(project, characterIds);
  const frames = await generateFrames({
    settings: await store.getSettings(),
    storyIdea,
    slideIdeas,
    slideIndex,
    frameCount: Math.min(Math.max(Number(frameCount) || 1, 1), 6),
    characters,
  });
  res.json({ frames: toStoredFrames(frames, characters) });
});

// Writes a whole story from the plot: slide ideas and all frames. The client decides layouts from frame counts.
app.post('/api/projects/:id/story/plan', async (req, res) => {
  const project = await store.getProject(req.params.id);
  const { storyIdea, slideCount, framesPerSlide, characterIds } = req.body || {};
  if (!storyIdea?.trim()) return res.status(400).json({ error: 'Hãy nhập cốt truyện' });

  const count = Math.min(Math.max(Number(slideCount) || 1, 1), 35);
  const perSlide = framesPerSlide === 'auto' ? 'auto' : Math.min(Math.max(Number(framesPerSlide) || 1, 1), 4);
  const characters = await castFor(project, characterIds);
  const slides = await generateStoryPlan({
    settings: await store.getSettings(),
    storyIdea: storyIdea.trim(),
    slideCount: count,
    framesPerSlide: perSlide,
    characters,
  });
  res.json({
    slides: slides.slice(0, count).map((s) => ({
      idea: s.idea || '',
      frames: toStoredFrames((s.frames || []).slice(0, perSlide === 'auto' ? 3 : perSlide), characters),
    })),
  });
});

// Vision pass over a generated frame: where each speaker is and where each bubble fits.
app.post('/api/projects/:id/frames/bubbles', async (req, res) => {
  const project = await store.getProject(req.params.id);
  const { image, scene = '', action = '', dialogues, characters = [] } = req.body || {};
  if (!image || !Array.isArray(dialogues) || !dialogues.length) {
    return res.status(400).json({ error: 'Khung cần có ảnh và lời thoại' });
  }
  const frameDir = path.join(store.PANEL_IMAGE_DIR, store.assertSafeName(project.id));
  const bubbles = await placeBubbles({
    settings: await store.getSettings(),
    image: await store.readImageAsInline(frameDir, image),
    scene: String(scene),
    action: String(action),
    dialogues: dialogues.map((d) => ({ speaker: String(d?.speaker || ''), text: String(d?.text || '') })),
    characters: (Array.isArray(characters) ? characters : []).map((c) => ({ name: String(c?.name || ''), description: String(c?.description || '') })),
  });
  res.json({ bubbles });
});

// Generates one frame image. Reference images: character refs + optionally the previous frame for style continuity.
app.post('/api/projects/:id/images/generate', async (req, res) => {
  const project = await store.getProject(req.params.id);
  const { prompt, characterIds = [], aspectRatio, styleRefImage } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt trống' });

  const characters = (await store.listCharacters()).filter((c) => characterIds.includes(c.id));
  const refs = [];
  for (const c of characters) {
    for (const file of c.images || []) {
      refs.push({ label: `Reference image of the character "${c.name}"`, ...(await store.readImageAsInline(store.CHARACTER_IMAGE_DIR, file)) });
    }
  }
  const frameDir = path.join(store.PANEL_IMAGE_DIR, store.assertSafeName(project.id));
  if (styleRefImage) {
    refs.push({
      label: 'Previous panel of the same comic – match its art style, color palette and character designs',
      ...(await store.readImageAsInline(frameDir, styleRefImage)),
    });
  }

  const image = await generateImage({ settings: await store.getSettings(), prompt, refs, aspectRatio });
  const file = await store.saveImage(frameDir, image.buffer, image.mimeType);
  res.json({ file });
});

app.post('/api/projects/:id/images/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
  const dir = path.join(store.PANEL_IMAGE_DIR, store.assertSafeName(req.params.id));
  res.json({ file: await store.saveImage(dir, req.file.buffer, req.file.mimetype) });
});

app.post('/api/projects/:id/caption', async (req, res) => {
  await store.getProject(req.params.id);
  const { title = '', storyIdea = '', slides } = req.body || {};
  if (!Array.isArray(slides) || !slides.length) return res.status(400).json({ error: 'Truyện chưa có ảnh nào' });

  const data = await generateCaption({
    settings: await store.getSettings(),
    title: String(title),
    storyIdea: String(storyIdea),
    slides: slides.map((s) => ({
      idea: String(s?.idea || ''),
      dialogues: Array.isArray(s?.dialogues) ? s.dialogues.map(String).filter(Boolean) : [],
    })),
  });
  const hashtags = (data.hashtags || [])
    .map((h) => `#${String(h).replace(/^#+/, '').replace(/\s+/g, '')}`)
    .filter((h) => h.length > 1)
    .join(' ');
  res.json({
    title: String(data.title || '').slice(0, 90),
    caption: data.caption || '',
    hashtags,
    musicMood: data.musicMood || '',
    musicKeywords: (data.musicKeywords || []).join(', '),
  });
});

// ---- LAN share (phone download via QR) ----
app.get('/api/share', (_req, res) => res.json(shareStatus()));

app.post('/api/share', upload.array('files', 35), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Không có ảnh để chia sẻ' });
  if (req.files.some((f) => f.mimetype !== 'image/png')) return res.status(400).json({ error: 'Chỉ chia sẻ ảnh PNG' });
  const { projectId = '', title = '', text = '', music = '' } = req.body || {};
  res.json(await startShare({ projectId, title, text, music, files: req.files.map((f) => f.buffer) }));
});

app.delete('/api/share', async (_req, res) => {
  await stopShare();
  res.json(shareStatus());
});

// ---- static files ----
app.use('/files/characters', express.static(store.CHARACTER_IMAGE_DIR, { maxAge: '1d' }));
app.use('/files/panels', express.static(store.PANEL_IMAGE_DIR, { maxAge: '1d' }));
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api|files).*/, (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (!err.status || err.status >= 500) console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Lỗi không xác định' });
});

await store.ensureDataDirs();
app.listen(PORT, '127.0.0.1', () => console.log(`StoryTools API: http://127.0.0.1:${PORT}`));
