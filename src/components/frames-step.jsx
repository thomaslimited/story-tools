import { useRef, useState } from 'react';
import { api, panelImageUrl } from '../api.js';
import { getLayout } from '../lib/layouts.js';
import { generateFrameImage, placeBubblesFromImage } from '../lib/frame-generation.js';
import { buildFramePrompt } from '../lib/prompt-builder.js';
import { frameEntries, frameLabel } from '../lib/story-model.js';
import ImageModelSelect from './image-model-select.jsx';

export default function FramesStep({ project, characters, settings, automation, changeImageModel, update, updateFrame }) {
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [errors, setErrors] = useState({});
  const [batch, setBatch] = useState(null);
  const stopRef = useRef(false);
  // Async loops read the latest project through this ref instead of a stale closure.
  const projectRef = useRef(project);
  projectRef.current = project;

  const setBusy = (id, on) =>
    setBusyIds((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /**
   * Generates one frame image. `styleRef` overrides the previous frame's image (used by batch runs,
   * where the previous frame's new image may not be in state yet).
   */
  async function generate(frameId, styleRef) {
    const p = projectRef.current;
    const entries = frameEntries(p);
    const k = entries.findIndex((e) => e.frame.id === frameId);
    if (k < 0) return null;
    const entry = entries[k];

    setBusy(frameId, true);
    setErrors((e) => ({ ...e, [frameId]: '' }));
    try {
      const { file, prompt } = await generateFrameImage(p, entry, characters, styleRef ?? entries[k - 1]?.frame.selectedImage);
      updateFrame(frameId, (f) => ({ prompt: f.prompt || prompt, images: [...(f.images || []), file], selectedImage: file }));
      // First image of a frame: let Gemini place the dialogue on it (kept only if the user hasn't placed bubbles meanwhile).
      if (entry.frame.bubbles == null) {
        placeBubblesFromImage(p, entry, characters, file)
          .then((placed) => placed && updateFrame(frameId, (f) => (f.bubbles == null ? placed : {})))
          .catch(() => {});
      }
      return file;
    } catch (err) {
      setErrors((e) => ({ ...e, [frameId]: err.message }));
      return null;
    } finally {
      setBusy(frameId, false);
    }
  }

  async function generateMissing() {
    stopRef.current = false;
    const targets = frameEntries(project)
      .map((e, k) => ({ id: e.frame.id, k, has: Boolean(e.frame.selectedImage) }))
      .filter((t) => !t.has);
    setBatch({ done: 0, total: targets.length });
    let lastFile;
    let lastK = -2;
    for (const [n, t] of targets.entries()) {
      if (stopRef.current) break;
      const file = await generate(t.id, lastK === t.k - 1 && lastFile ? lastFile : undefined);
      lastFile = file;
      lastK = t.k;
      setBatch({ done: n + 1, total: targets.length });
    }
    setBatch(null);
  }

  async function uploadImage(frameId, file) {
    try {
      const { file: saved } = await api.uploadPanelImage(project.id, file);
      updateFrame(frameId, (f) => ({ images: [...(f.images || []), saved], selectedImage: saved }));
    } catch (err) {
      setErrors((e) => ({ ...e, [frameId]: err.message }));
    }
  }

  function fillAllPrompts() {
    const entries = frameEntries(project);
    if (entries.some((e) => e.frame.prompt?.trim()) && !confirm('Ghi đè toàn bộ prompt đã sửa bằng prompt tạo từ kịch bản?')) return;
    update((p) => ({
      slides: p.slides.map((s) => ({ ...s, frames: s.frames.map((f) => ({ ...f, prompt: buildFramePrompt(p, s, f, characters) })) })),
    }));
  }

  const entries = frameEntries(project);
  if (!entries.length) return <p className="muted">Chưa có ảnh nào, quay lại bước Kịch bản.</p>;
  const missing = entries.filter((e) => !e.frame.selectedImage).length;
  const nameOf = (id) => characters.find((c) => c.id === id)?.name || '?';

  return (
    <div className="stack">
      <section className="card row wrap between">
        <div className="row wrap">
          <button onClick={fillAllPrompts}>Tạo prompt cho tất cả khung</button>
          {batch ? (
            <>
              <span>Đang tạo {batch.done}/{batch.total}…</span>
              <button className="danger" onClick={() => (stopRef.current = true)}>Dừng sau ảnh này</button>
            </>
          ) : (
            <button className="primary" disabled={!missing || automation.running} onClick={generateMissing}>
              🎨 Tạo ảnh cho {missing} khung chưa có ảnh
            </button>
          )}
        </div>
        <label className="check">
          <input type="checkbox" checked={Boolean(project.usePrevFrameRef)} onChange={(e) => update({ usePrevFrameRef: e.target.checked })} />
          Gửi kèm ảnh khung trước để giữ phong cách
        </label>
        <ImageModelSelect
          value={settings?.imageModel || ''}
          frames={missing}
          disabled={Boolean(batch) || automation.running}
          onChange={changeImageModel}
        />
      </section>

      {entries.map(({ slide, frame, s, f, frameCount, aspectRatio }) => {
        const busy = busyIds.has(frame.id);
        return (
          <div key={frame.id} className="stack">
            {f === 0 && (
              <div className="slide-heading">
                <h2>Ảnh {s + 1}</h2>
                <span className="muted small">{getLayout(project.orientation, slide.layoutId).label}</span>
                {slide.idea && <p className="small">{slide.idea}</p>}
              </div>
            )}
            <section className="card panel-row">
              <div className="stack">
                <h3>
                  {frameLabel(s, f, frameCount)} <span className="muted small">tỉ lệ {aspectRatio}</span>
                </h3>
                <p className="small">
                  <b>Bối cảnh:</b> {frame.scene || '—'} <br />
                  <b>Hành động:</b> {frame.action || '—'} <br />
                  <b>Nhân vật:</b> {frame.characterIds.map(nameOf).join(', ') || '—'}
                </p>
                {frame.dialogues.length > 0 && (
                  <ul className="small dialogue-list">
                    {frame.dialogues.map((d, k) => (
                      <li key={k}><b>{d.speakerId ? nameOf(d.speakerId) : '…'}:</b> {d.text}</li>
                    ))}
                  </ul>
                )}
                <label>
                  Prompt
                  <textarea
                    rows={9}
                    className="mono"
                    value={frame.prompt || ''}
                    placeholder={buildFramePrompt(project, slide, frame, characters)}
                    onChange={(e) => updateFrame(frame.id, { prompt: e.target.value })}
                  />
                </label>
                <div>
                  <button onClick={() => updateFrame(frame.id, { prompt: buildFramePrompt(project, slide, frame, characters) })}>
                    Tạo lại prompt từ kịch bản
                  </button>
                </div>
              </div>

              <div className="stack">
                <div className="preview" style={{ aspectRatio: aspectRatio.replace(':', ' / ') }}>
                  {frame.selectedImage ? (
                    <img src={panelImageUrl(project.id, frame.selectedImage)} alt="" />
                  ) : (
                    <span className="muted">Chưa có ảnh</span>
                  )}
                  {busy && <div className="overlay">Đang tạo ảnh…</div>}
                </div>
                <div className="row wrap">
                  <button className="primary" disabled={busy || automation.running} onClick={() => generate(frame.id)}>
                    {frame.selectedImage ? 'Tạo lại' : 'Tạo ảnh'}
                  </button>
                  <label className="button">
                    Tải ảnh lên
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(e) => {
                        if (e.target.files[0]) uploadImage(frame.id, e.target.files[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {errors[frame.id] && <p className="error small">{errors[frame.id]}</p>}
                {frame.images?.length > 1 && (
                  <div className="thumbs">
                    {frame.images.map((file) => (
                      <img
                        key={file}
                        className={file === frame.selectedImage ? 'active' : ''}
                        src={panelImageUrl(project.id, file)}
                        title="Chọn ảnh này"
                        alt=""
                        onClick={() => updateFrame(frame.id, { selectedImage: file })}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
