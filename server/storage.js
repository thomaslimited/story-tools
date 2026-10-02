// File-based storage: everything lives under <project root>/data as JSON + image files.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// DATA_DIR lets tests and demos run against a separate folder without touching real data.
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const CHARACTER_IMAGE_DIR = path.join(DATA_DIR, 'characters');
export const PANEL_IMAGE_DIR = path.join(DATA_DIR, 'panels');
const PROJECT_DIR = path.join(DATA_DIR, 'projects');
const CHARACTERS_FILE = path.join(DATA_DIR, 'characters.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const SAFE_NAME = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/;

/** Rejects ids/filenames that could escape the data directory. */
export function assertSafeName(name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name)) {
    const err = new Error(`Tên không hợp lệ: ${name}`);
    err.status = 400;
    throw err;
  }
  return name;
}

export const newId = () => crypto.randomBytes(6).toString('hex');

export async function ensureDataDirs() {
  await Promise.all(
    [PROJECT_DIR, CHARACTER_IMAGE_DIR, PANEL_IMAGE_DIR].map((d) => fs.mkdir(d, { recursive: true })),
  );
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

// Write to a temp file first so a crash never leaves half-written JSON.
async function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

// ---- settings ----
export async function getSettings() {
  const saved = await readJson(SETTINGS_FILE, {});
  return {
    apiKey: saved.apiKey || process.env.GEMINI_API_KEY || '',
    textModel: saved.textModel || process.env.GEMINI_TEXT_MODEL || 'gemini-3.8-flash',
    imageModel: saved.imageModel || process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
  };
}

export async function saveSettings(patch) {
  const saved = await readJson(SETTINGS_FILE, {});
  await writeJson(SETTINGS_FILE, { ...saved, ...patch });
}

// ---- characters ----
export const listCharacters = () => readJson(CHARACTERS_FILE, []);
export const saveCharacters = (characters) => writeJson(CHARACTERS_FILE, characters);

// ---- projects ----
const projectFile = (id) => path.join(PROJECT_DIR, `${assertSafeName(id)}.json`);

export async function listProjects() {
  const files = (await fs.readdir(PROJECT_DIR)).filter((f) => f.endsWith('.json'));
  const projects = await Promise.all(files.map((f) => readJson(path.join(PROJECT_DIR, f), null)));
  return projects
    .filter(Boolean)
    .map(({ id, title, orientation, updatedAt, slides, publish }) => ({
      id,
      title,
      orientation,
      updatedAt,
      slideCount: slides?.length || 0,
      publishStatus: publish?.status || 'draft',
    }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getProject(id) {
  const project = await readJson(projectFile(id), null);
  if (!project) {
    const err = new Error('Không tìm thấy truyện');
    err.status = 404;
    throw err;
  }
  return project;
}

export async function saveProject(project) {
  const data = { ...project, updatedAt: new Date().toISOString() };
  await writeJson(projectFile(project.id), data);
  return data;
}

export async function deleteProject(id) {
  await fs.rm(projectFile(id), { force: true });
  await fs.rm(path.join(PANEL_IMAGE_DIR, assertSafeName(id)), { recursive: true, force: true });
}

// ---- images ----
const EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const MIME_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]));

/** Saves an image buffer into dir and returns the generated filename. */
export async function saveImage(dir, buffer, mimeType) {
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) {
    const err = new Error(`Định dạng ảnh không hỗ trợ: ${mimeType}`);
    err.status = 400;
    throw err;
  }
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${newId()}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return filename;
}

export async function readImageAsInline(dir, filename) {
  const ext = path.extname(assertSafeName(filename)).slice(1).toLowerCase();
  const data = await fs.readFile(path.join(dir, filename));
  return { mimeType: MIME_BY_EXT[ext] || 'image/png', data: data.toString('base64') };
}
