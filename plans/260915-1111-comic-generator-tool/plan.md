# Comic Generator Tool (localhost)

Status: implemented – UI/compose/export verified with seeded images; live Gemini calls not yet verified (no API key)

## Decisions (user-confirmed)
- Stack: Node full-stack — React (Vite) + Express + `@google/genai`. No Python.
- Multi-panel pages: generate each panel separately, compose on canvas.
- Speech bubbles: auto-placed, then drag/resize/edit on canvas.

## Revision 2026-09-15 (user feedback)
- Model: story -> slides (published images, each with own idea + layout) -> frames (own script fields + prompt + image).
- Single-frame slide = full-bleed, no border; only multi-frame slides are composed.
- No clock field at all (forced clocks looked out of place); time of day only via scene/prompt text. Saved prompts get the clock line stripped on load.
- New step 4: whole-story preview carousel + PNG/PDF export. Old flat `panels` projects auto-migrate client-side.

## Revision 2026-09-15 – publishing (option A: manual TikTok post)
- No TikTok API (no music selection param, unaudited = private only, personal tools not auditable).
- Step 4 "Duyệt & đăng": status draft/approved/posted, Gemini caption/hashtags/music mood, copy buttons, PNG/PDF export.
- LAN share: separate 0.0.0.0 server (`server/lan-share.js`) serving only `/s/<token>`, 30-min TTL, QR codes per LAN address.

## Revision 2026-09-15 – full automation
- Plot + slide count + frames per slide (fixed 1–4 or auto 1–3) -> one Gemini call writes all slides/frames (`/story/plan`).
- Editor-level runner (`use-story-automation.js`): draw missing frames in order, then vision pass (`/frames/bubbles`) places bubbles + rewords lines; resumable, stoppable, cost confirm.
- Compose: double-click inline bubble text edit; per-frame "AI đặt thoại".
- Tests must use isolated `DATA_DIR` + ports (live data was overwritten once by a seed script).

## Pipeline (original)
1. Characters: name, fixed description, 1-3 reference images.
2. Script: idea/script -> Gemini text (JSON schema) -> panels {scene, action, expression, clock, characters, dialogues}.
3. Prompt: deterministic builder = style + character descriptions + panel fields + "no text in image".
4. Images: Gemini image model, ref images inline, aspect ratio from layout cell; keep history per panel.
5. Compose: page 1080x1920 (TikTok) or 1920x1080 (YouTube), layout templates, borders, clock, bubbles (Be Vietnam Pro); export PNG / PDF.

## Structure
- `server/` index.js (routes), storage.js (JSON + files in `data/`), gemini.js, prompt-builder.js
- `src/` React UI; `src/lib/` layouts.js, render-page.js (shared by preview + export), export.js

## Acceptance
- `npm run dev` opens UI; full flow works with a valid GEMINI_API_KEY.
- Vietnamese diacritics render correctly in bubbles and exports.
- Re-generate single panel without affecting others.

## Risks
- Image models have no free tier; costs per attempt.
- Character consistency limited to reference images + fixed description (LoRA out of scope).
