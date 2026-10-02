import { useRef, useState } from 'react';
import { api } from '../api.js';
import { pendingFrames } from '../hooks/use-story-automation.js';
import { formatUsd, imageCostPerAttempt } from '../lib/cost-estimate.js';
import { LAYOUTS, PAGE_SIZES, framesPerLayout, getLayout } from '../lib/layouts.js';
import { createSlide, fitFrames, hasFrameContent, switchOrientation } from '../lib/story-model.js';
import FrameFields from './frame-fields.jsx';
import ImageModelSelect from './image-model-select.jsx';

const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export default function ScriptStep({
  project,
  characters,
  settings,
  automation,
  changeImageModel,
  update,
  updateSlide,
  updateFrame,
  onAutomationDone,
}) {
  const [busy, setBusy] = useState({}); // slideId -> boolean
  const [errors, setErrors] = useState({});
  const [batchRunning, setBatchRunning] = useState(false);
  const [slideCount, setSlideCount] = useState(5);
  const [framesPerSlide, setFramesPerSlide] = useState('auto');
  const [pauseForReview, setPauseForReview] = useState(false);
  // Async calls read the latest project through this ref instead of a stale closure.
  const projectRef = useRef(project);
  projectRef.current = project;
  const cast = characters.filter((c) => project.characterIds.includes(c.id));

  const imageModel = settings?.imageModel || '';
  const perImage = imageCostPerAttempt(imageModel);
  const plannedFrames = slideCount * (framesPerSlide === 'auto' ? 2 : Number(framesPerSlide));
  const missingImages = pendingFrames(project).filter((e) => !e.frame.selectedImage).length;
  const pending = pendingFrames(project).length;
  const anyBusy = automation.running || batchRunning;

  function startAutomation() {
    if (project.slides.some((s) => s.frames.some(hasFrameContent)) && !confirm('Thay toàn bộ các ảnh hiện có bằng truyện mới?')) return;
    const options = { slideCount, framesPerSlide };
    if (pauseForReview) {
      automation.writeStory(options);
      return;
    }
    const message = `Gemini sẽ viết ${slideCount} ảnh rồi vẽ khoảng ${plannedFrames} khung.\nƯớc tính ~${formatUsd(plannedFrames * perImage)} nếu mỗi khung vẽ 1 lần (model ${imageModel}).\n\nTiếp tục?`;
    if (!confirm(message)) return;
    automation.runAll(options).then((ok) => ok && onAutomationDone());
  }

  function resumeAutomation() {
    if (missingImages && !confirm(`Vẽ ${missingImages} khung còn thiếu, ước tính ~${formatUsd(missingImages * perImage)}. Tiếp tục?`)) return;
    automation.fillFrames().then((ok) => ok && onAutomationDone());
  }

  /** Asks Gemini to write exactly as many frames as the slide's layout holds. */
  async function writeFrames(slideId, { skipConfirm = false } = {}) {
    const p = projectRef.current;
    const slideIndex = p.slides.findIndex((s) => s.id === slideId);
    const slide = p.slides[slideIndex];
    if (!slide) return;
    if (!skipConfirm && slide.frames.some(hasFrameContent) && !confirm(`Ghi đè nội dung và ảnh các khung của Ảnh ${slideIndex + 1}?`)) {
      return;
    }
    setBusy((b) => ({ ...b, [slideId]: true }));
    setErrors((e) => ({ ...e, [slideId]: '' }));
    try {
      const { frames } = await api.generateFrames(p.id, {
        storyIdea: p.idea,
        slideIdeas: p.slides.map((s) => s.idea),
        slideIndex,
        frameCount: framesPerLayout(getLayout(p.orientation, slide.layoutId)),
        characterIds: p.characterIds,
      });
      updateSlide(slideId, (s) => ({ frames: fitFrames(frames, getLayout(projectRef.current.orientation, s.layoutId)) }));
    } catch (err) {
      setErrors((e) => ({ ...e, [slideId]: err.message }));
    } finally {
      setBusy((b) => ({ ...b, [slideId]: false }));
    }
  }

  async function writeAllEmpty() {
    setBatchRunning(true);
    const targets = project.slides.filter((s) => s.idea.trim() && !s.frames.some(hasFrameContent));
    for (const s of targets) await writeFrames(s.id, { skipConfirm: true });
    setBatchRunning(false);
  }

  function changeLayout(slide, layoutId) {
    const layout = getLayout(project.orientation, layoutId);
    const n = framesPerLayout(layout);
    if (slide.frames.slice(n).some(hasFrameContent) && !confirm(`Bố cục mới chỉ có ${n} khung, các khung thừa sẽ bị xoá. Tiếp tục?`)) {
      return;
    }
    updateSlide(slide.id, (s) => ({ layoutId: layout.id, frames: fitFrames(s.frames, layout) }));
  }

  const moveSlide = (index, delta) =>
    update((p) => {
      const slides = [...p.slides];
      const target = index + delta;
      if (target < 0 || target >= slides.length) return {};
      [slides[index], slides[target]] = [slides[target], slides[index]];
      return { slides };
    });

  const emptyWithIdea = project.slides.filter((s) => s.idea.trim() && !s.frames.some(hasFrameContent)).length;

  return (
    <div className="stack">
      <section className="card stack">
        <h3>Thiết lập truyện</h3>
        <label className="inline">
          Khổ ảnh
          <select value={project.orientation} disabled={anyBusy} onChange={(e) => update((p) => switchOrientation(p, e.target.value))}>
            {Object.entries(PAGE_SIZES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <label>
          Phong cách vẽ (chèn vào mọi prompt)
          <textarea rows={2} value={project.style} onChange={(e) => update({ style: e.target.value })} />
        </label>
        <div>
          <div className="label">Nhân vật trong truyện</div>
          {characters.length === 0 ? (
            <p className="muted small">Chưa có nhân vật, vào tab Nhân vật để tạo.</p>
          ) : (
            <div className="chips">
              {characters.map((c) => (
                <button
                  key={c.id}
                  className={`chip ${project.characterIds.includes(c.id) ? 'active' : ''}`}
                  onClick={() => update((p) => ({ characterIds: toggle(p.characterIds, c.id) }))}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card stack">
        <h3>🤖 Tự động tạo truyện</h3>
        <label>
          Cốt truyện
          <textarea
            rows={5}
            value={project.idea}
            onChange={(e) => update({ idea: e.target.value })}
            placeholder="VD: Minh 13 tuổi đi làm thêm ở quán cà phê để phụ tiền học. Ngày đầu bị nhắc nhở liên tục, bưng bia vội, rửa ly đứt tay nhưng vẫn cố. Tối về nhà, bố chờ sẵn với ly nước, hai bố con nói chuyện và Minh hiểu bố cũng từng như vậy."
          />
        </label>
        <div className="row wrap">
          <label className="inline">
            Số ảnh
            <input type="number" min={1} max={35} value={slideCount} onChange={(e) => setSlideCount(Math.min(35, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
          <label className="inline">
            Khung mỗi ảnh
            <select value={framesPerSlide} onChange={(e) => setFramesPerSlide(e.target.value)}>
              <option value="auto">Gemini tự chọn (1–3)</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} khung</option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={pauseForReview} onChange={(e) => setPauseForReview(e.target.checked)} />
            Dừng lại để duyệt kịch bản trước khi vẽ
          </label>
        </div>
        <ImageModelSelect value={imageModel} frames={plannedFrames} disabled={anyBusy} onChange={changeImageModel} />
        <div className="row wrap">
          <button className="primary" disabled={anyBusy || !project.idea.trim()} onClick={startAutomation}>
            {pauseForReview ? '✨ Viết kịch bản' : '🤖 Tự động tạo cả truyện'}
          </button>
          {pending > 0 && (
            <button disabled={anyBusy} onClick={resumeAutomation}>
              🎨 {missingImages ? `Vẽ ${missingImages} khung còn thiếu & đặt thoại` : `Đặt thoại cho ${pending} khung`}
            </button>
          )}
        </div>
        {automation.progress && (
          <div className="progress-pill row wrap">
            <span>
              ⏳ {automation.progress.label}
              {automation.progress.total ? ` (${automation.progress.done + 1}/${automation.progress.total})` : ''}
            </span>
            <button className="danger" onClick={automation.stop}>Dừng sau bước này</button>
          </div>
        )}
        {automation.error && <p className="error small">{automation.error}</p>}
        <p className="muted small">
          Gemini viết cả truyện, vẽ từng khung, rồi nhìn ảnh để đặt bóng thoại. Xong sẽ chuyển sang bước 3: nhấp đúp bóng thoại để sửa chữ, kéo để đổi
          vị trí. Sau đó bước 4 để duyệt và đăng.
        </p>
      </section>

      {project.slides.map((slide, i) => {
        const layout = getLayout(project.orientation, slide.layoutId);
        const n = framesPerLayout(layout);
        return (
          <section key={slide.id} className="card stack">
            <div className="row wrap between">
              <h3>Ảnh {i + 1}</h3>
              <div className="row wrap">
                <select value={layout.id} disabled={anyBusy} onChange={(e) => changeLayout(slide, e.target.value)}>
                  {LAYOUTS[project.orientation].map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
                <button onClick={() => moveSlide(i, -1)} disabled={i === 0 || anyBusy}>↑</button>
                <button onClick={() => moveSlide(i, 1)} disabled={i === project.slides.length - 1 || anyBusy}>↓</button>
                <button
                  className="danger"
                  disabled={anyBusy}
                  onClick={() => confirm(`Xoá Ảnh ${i + 1}?`) && update((p) => ({ slides: p.slides.filter((s) => s.id !== slide.id) }))}
                >
                  Xoá
                </button>
              </div>
            </div>
            <textarea
              rows={3}
              value={slide.idea}
              onChange={(e) => updateSlide(slide.id, { idea: e.target.value })}
              placeholder={
                n > 1
                  ? 'Ý tưởng ảnh này, VD: Một ngày của Minh: sáng quét nhà bị nhắc, trưa bưng bia, chiều rửa ly đứt tay, tối được khách cảm ơn'
                  : 'Ý tưởng ảnh này, VD: Buổi sáng, chú chủ quán nhắc Minh quét sát chân bàn'
              }
            />
            <div className="row wrap">
              <button className="primary" disabled={busy[slide.id] || anyBusy || !slide.idea.trim()} onClick={() => writeFrames(slide.id)}>
                {busy[slide.id] ? 'Gemini đang viết…' : `✨ Gemini viết ${n} khung`}
              </button>
              {errors[slide.id] && <span className="error small">{errors[slide.id]}</span>}
            </div>
            {slide.frames.map((frame, j) => (
              <FrameFields key={frame.id} frame={frame} title={n > 1 ? `Khung ${j + 1}` : null} cast={cast} updateFrame={updateFrame} />
            ))}
          </section>
        );
      })}

      <section className="card row wrap">
        <button
          className="primary"
          disabled={anyBusy}
          onClick={() => update((p) => ({ slides: [...p.slides, createSlide(p.orientation, p.slides.at(-1)?.layoutId)] }))}
        >
          + Thêm ảnh thủ công
        </button>
        {emptyWithIdea > 0 && (
          <button disabled={anyBusy} onClick={writeAllEmpty}>
            {batchRunning ? 'Gemini đang viết…' : `✨ Viết khung cho ${emptyWithIdea} ảnh chưa có nội dung`}
          </button>
        )}
        {!project.slides.length && <span className="muted small">Mỗi ảnh là 1 slide khi đăng. Ảnh có thể gồm 1 hoặc nhiều khung.</span>}
      </section>
    </div>
  );
}
