import { useEffect, useRef, useState } from 'react';
import { renderSlideToBlob } from '../lib/export.js';
import { ensureFonts, loadFrameImages } from '../lib/image-cache.js';
import PublishPanel from './publish-panel.jsx';

/** Swipe-style viewer of the whole story (final images with bubbles) plus the approval/publishing panel. */
export default function PreviewStep({ project, update }) {
  const [rendered, setRendered] = useState(null); // { blobs, urls }
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const projectRef = useRef(project);
  projectRef.current = project;

  // Re-render images only when visual content changes, not when caption/status fields are edited.
  const renderKey = JSON.stringify([project.id, project.orientation, project.slides]);
  useEffect(() => {
    const p = projectRef.current;
    let alive = true;
    let urls = [];
    (async () => {
      await ensureFonts();
      const blobs = [];
      for (const slide of p.slides) {
        const images = await loadFrameImages(p.id, slide.frames);
        blobs.push(await renderSlideToBlob({ project: p, slide, images }));
      }
      if (!alive) return;
      urls = blobs.map((b) => URL.createObjectURL(b));
      setRendered({ blobs, urls });
    })().catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [renderKey]);

  const count = project.slides.length;
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, count - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  if (!count) return <p className="muted">Chưa có ảnh nào, quay lại bước Kịch bản.</p>;
  if (error) return <p className="error">{error}</p>;
  if (!rendered) return <p className="muted">Đang dựng {count} ảnh…</p>;

  const current = Math.min(index, count - 1);
  const missingFrames = project.slides.flatMap((s) => s.frames).filter((f) => !f.selectedImage).length;

  return (
    <div className="stack">
      <div className="viewer">
        <button className="nav" disabled={current === 0} onClick={() => setIndex(current - 1)} aria-label="Ảnh trước">‹</button>
        <div className="viewer-stage">
          <img className={`viewer-img ${project.orientation}`} src={rendered.urls[current]} alt={`Ảnh ${current + 1}`} />
          <div className="dots">
            {rendered.urls.map((_, i) => (
              <button key={i} className={`dot ${i === current ? 'active' : ''}`} onClick={() => setIndex(i)} aria-label={`Ảnh ${i + 1}`} />
            ))}
          </div>
        </div>
        <button className="nav" disabled={current === count - 1} onClick={() => setIndex(current + 1)} aria-label="Ảnh sau">›</button>
      </div>

      <div className="strip">
        {rendered.urls.map((url, i) => (
          <button key={url} className={`strip-item ${i === current ? 'active' : ''}`} onClick={() => setIndex(i)}>
            <img src={url} alt="" />
            <span className="small">Ảnh {i + 1}</span>
          </button>
        ))}
      </div>

      <PublishPanel project={project} update={update} blobs={rendered.blobs} missingFrames={missingFrames} />
    </div>
  );
}
