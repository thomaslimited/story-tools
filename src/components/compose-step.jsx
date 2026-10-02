import { useEffect, useRef, useState } from 'react';
import { autoPlaceBubbles, createBubble } from '../lib/bubbles.js';
import { downloadBlob, renderSlideToBlob, slugify } from '../lib/export.js';
import { placeBubblesFromImage } from '../lib/frame-generation.js';
import { ensureFonts, loadFrameImages } from '../lib/image-cache.js';
import { PAGE_SIZES, aspectRatioForFrame, computeCells, getLayout } from '../lib/layouts.js';
import { FONT_FAMILY, renderSlide } from '../lib/render-slide.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) <= r;
const inside = (pt, box) => pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h;

export default function ComposeStep({ project, characters, automation, updateFrame }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [selection, setSelection] = useState(null); // { frameId, bubbleId }
  const [editing, setEditing] = useState(null); // { frameId, bubbleId, text, style }
  const [images, setImages] = useState(() => new Map());
  const [fontsReady, setFontsReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [aiBusy, setAiBusy] = useState(null); // frameId being placed by AI
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const hitsRef = useRef({ hits: [] });
  const dragRef = useRef(null);

  const page = PAGE_SIZES[project.orientation] || PAGE_SIZES.portrait;
  const current = Math.min(slideIndex, Math.max(project.slides.length - 1, 0));
  const slide = project.slides[current];
  const layout = slide && getLayout(project.orientation, slide.layoutId);
  const cells = slide ? computeCells(project.orientation, layout) : [];

  const placeBubbles = (frame, i) => autoPlaceBubbles(frame, { cellAspect: cells[i].w / cells[i].h, frameCount: cells.length });

  // Persist template bubbles for frames nobody placed yet (AI placement is skipped while automation still works on them).
  useEffect(() => {
    if (automation.running) return;
    slide?.frames.forEach((frame, i) => {
      if (frame.bubbles == null && cells[i]) updateFrame(frame.id, { bubbles: placeBubbles(frame, i) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, project.orientation, automation.running]);

  useEffect(() => {
    ensureFonts().then(() => setFontsReady(true));
  }, []);

  const imageKey = slide ? slide.frames.map((f) => f.selectedImage).join('|') : '';
  useEffect(() => {
    if (!slide) return;
    let alive = true;
    loadFrameImages(project.id, slide.frames).then((map) => alive && setImages(map));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, imageKey]);

  // Redraw after every render; drawing is cheap because images are cached.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontsReady || !slide) return;
    hitsRef.current = renderSlide(canvas.getContext('2d'), { project, slide, images, selection });
  });

  const updateBubble = (frameId, bubbleId, patch) =>
    updateFrame(frameId, (f) => ({ bubbles: f.bubbles.map((b) => (b.id === bubbleId ? { ...b, ...patch } : b)) }));

  const findBubble = (hit) => hit && slide.frames.find((f) => f.id === hit.frameId)?.bubbles?.find((b) => b.id === hit.bubbleId);

  function toCanvasPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * page.w) / rect.width, y: ((e.clientY - rect.top) * page.h) / rect.height };
  }

  function onPointerDown(e) {
    const pt = toCanvasPoint(e);
    const { hits } = hitsRef.current;
    const selectedHit = selection && hits.find((h) => h.bubbleId === selection.bubbleId);
    let hit = null;
    let mode = 'move';
    if (selectedHit && near(pt, selectedHit.box.tail, 30)) {
      hit = selectedHit;
      mode = 'tail';
    } else if (selectedHit && near(pt, { x: selectedHit.box.x + selectedHit.box.w + 8, y: selectedHit.box.y + selectedHit.box.h / 2 }, 26)) {
      hit = selectedHit;
      mode = 'resize';
    } else {
      hit = [...hits].reverse().find((h) => inside(pt, h.box));
    }
    const bubble = findBubble(hit);
    if (!bubble) {
      setSelection(null);
      return;
    }
    setSelection({ frameId: hit.frameId, bubbleId: hit.bubbleId });
    dragRef.current = { mode, hit, start: pt, bubble };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const pt = toCanvasPoint(e);
    const { cell } = drag.hit;
    const { bubble } = drag;
    let patch;
    if (drag.mode === 'move') {
      patch = {
        cx: clamp(bubble.cx + (pt.x - drag.start.x) / cell.w, 0, 1),
        cy: clamp(bubble.cy + (pt.y - drag.start.y) / cell.h, 0, 1),
      };
    } else if (drag.mode === 'tail') {
      patch = { tx: clamp((pt.x - cell.x) / cell.w, 0, 1), ty: clamp((pt.y - cell.y) / cell.h, 0, 1) };
    } else {
      patch = { w: clamp((2 * Math.abs(pt.x - (cell.x + bubble.cx * cell.w))) / cell.w, 0.12, 0.95) };
    }
    updateBubble(drag.hit.frameId, drag.hit.bubbleId, patch);
  }

  const onPointerUp = () => {
    dragRef.current = null;
  };

  /** Double-click a bubble to edit its text in place, over the canvas. */
  function onDoubleClick(e) {
    const pt = toCanvasPoint(e);
    const hit = [...hitsRef.current.hits].reverse().find((h) => inside(pt, h.box));
    const bubble = findBubble(hit);
    if (!bubble) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const wrapRect = wrapRef.current.getBoundingClientRect();
    const scale = canvasRect.width / page.w;
    const width = Math.max(hit.box.w * scale, 180);
    setEditing({
      frameId: hit.frameId,
      bubbleId: hit.bubbleId,
      text: bubble.text,
      style: {
        left: canvasRect.left - wrapRect.left + (hit.box.x + hit.box.w / 2) * scale - width / 2,
        top: canvasRect.top - wrapRect.top + hit.box.y * scale,
        width,
        minHeight: Math.max(hit.box.h * scale, 44),
        fontSize: Math.max(bubble.fontSize * scale, 13),
        fontFamily: FONT_FAMILY,
      },
    });
  }

  function commitEdit() {
    if (!editing) return;
    const text = editing.text.trim();
    if (text) updateBubble(editing.frameId, editing.bubbleId, { text });
    setEditing(null);
  }

  async function aiPlace(frame, i) {
    if (frame.bubbles?.length && !confirm('AI xem ảnh và đặt lại bóng thoại khung này (có thể chỉnh câu chữ)?')) return;
    setAiBusy(frame.id);
    try {
      const entry = { slide, frame, s: current, f: i, frameCount: cells.length, aspectRatio: aspectRatioForFrame(project.orientation, layout, i) };
      const placed = await placeBubblesFromImage(project, entry, characters);
      if (!placed) alert('Khung cần có ảnh và lời thoại trong kịch bản.');
      else {
        updateFrame(frame.id, placed);
        setSelection(null);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAiBusy(null);
    }
  }

  async function exportCurrent() {
    setExporting(true);
    try {
      await ensureFonts();
      const blob = await renderSlideToBlob({ project, slide, images: await loadFrameImages(project.id, slide.frames) });
      downloadBlob(blob, `${slugify(project.title)}-anh-${current + 1}.png`);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  if (!slide) return <p className="muted">Chưa có ảnh nào, quay lại bước Kịch bản.</p>;

  const selectedFrame = selection && slide.frames.find((f) => f.id === selection.frameId);
  const selectedBubble = selectedFrame?.bubbles?.find((b) => b.id === selection.bubbleId);
  const multi = cells.length > 1;

  return (
    <div className="compose">
      <div className="compose-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          width={page.w}
          height={page.h}
          className={`compose-canvas ${project.orientation}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        />
        {editing && (
          <textarea
            className="bubble-editor"
            autoFocus
            style={editing.style}
            value={editing.text}
            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            onBlur={commitEdit}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(null);
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitEdit();
              }
            }}
          />
        )}
      </div>

      <aside className="stack compose-side">
        <section className="card stack">
          <div className="label">Chọn ảnh</div>
          <div className="row wrap">
            {project.slides.map((s, i) => (
              <button
                key={s.id}
                className={`tab ${i === current ? 'active' : ''}`}
                onClick={() => {
                  setSlideIndex(i);
                  setSelection(null);
                  setEditing(null);
                }}
              >
                Ảnh {i + 1}{s.frames.length > 1 ? ` (${s.frames.length} khung)` : ''}
              </button>
            ))}
          </div>
        </section>

        <section className="card stack">
          <h3>Bóng thoại</h3>
          {selectedBubble ? (
            <>
              <textarea
                rows={3}
                value={selectedBubble.text}
                onChange={(e) => updateBubble(selectedFrame.id, selectedBubble.id, { text: e.target.value })}
              />
              <label>
                Cỡ chữ: {selectedBubble.fontSize}px
                <input
                  type="range"
                  min={18}
                  max={90}
                  value={selectedBubble.fontSize}
                  onChange={(e) => updateBubble(selectedFrame.id, selectedBubble.id, { fontSize: Number(e.target.value) })}
                />
              </label>
              <div className="row">
                <button
                  className="danger"
                  onClick={() => {
                    updateFrame(selectedFrame.id, (f) => ({ bubbles: f.bubbles.filter((b) => b.id !== selectedBubble.id) }));
                    setSelection(null);
                  }}
                >
                  Xoá bóng thoại
                </button>
              </div>
            </>
          ) : (
            <p className="muted small">
              Nhấp đúp vào bóng thoại để sửa chữ (Enter lưu, Esc huỷ). Bấm để chọn, kéo thân để di chuyển, kéo chấm xanh để chỉnh đuôi, kéo ô vuông bên
              phải để đổi độ rộng.
            </p>
          )}
          {slide.frames.map((frame, i) => (
            <div key={frame.id} className="row wrap">
              <span className="small grow nowrap">{multi ? `Khung ${i + 1}` : 'Ảnh này'}</span>
              <button
                disabled={!frame.selectedImage || aiBusy === frame.id || automation.running}
                title="Gemini xem ảnh để đặt bóng thoại vào vùng trống, đuôi chỉ về người nói"
                onClick={() => aiPlace(frame, i)}
              >
                {aiBusy === frame.id ? 'AI đang xem…' : '✨ AI đặt thoại'}
              </button>
              <button
                onClick={() => {
                  const bubble = createBubble(multi ? 34 : 42);
                  updateFrame(frame.id, (f) => ({ bubbles: [...(f.bubbles || []), bubble] }));
                  setSelection({ frameId: frame.id, bubbleId: bubble.id });
                }}
              >
                + Bóng
              </button>
              <button
                onClick={() => {
                  if (confirm('Đặt lại bóng thoại theo mẫu từ lời thoại trong kịch bản?')) {
                    updateFrame(frame.id, { bubbles: placeBubbles(frame, i) });
                    setSelection(null);
                  }
                }}
              >
                Đặt lại
              </button>
            </div>
          ))}
        </section>

        <section className="card stack">
          <div className="row wrap">
            <button disabled={exporting} onClick={exportCurrent}>Tải PNG ảnh này</button>
          </div>
          <p className="muted small">
            {page.w}×{page.h}px. Xem cả truyện và đăng ở bước 4.
          </p>
        </section>
      </aside>
    </div>
  );
}
