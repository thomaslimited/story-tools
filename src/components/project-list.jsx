import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { PAGE_SIZES } from '../lib/layouts.js';
import { statusLabel } from '../lib/publish.js';

export default function ProjectList({ onOpen }) {
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState('');
  const [orientation, setOrientation] = useState('portrait');
  const [error, setError] = useState('');

  const load = () => api.listProjects().then(setProjects).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    try {
      const project = await api.createProject({ title, orientation });
      onOpen(project.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(p) {
    if (!confirm(`Xoá truyện "${p.title}" và toàn bộ ảnh đã tạo?`)) return;
    await api.deleteProject(p.id).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="stack">
      <form className="card row wrap" onSubmit={create}>
        <input className="grow" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên truyện mới" />
        <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
          {Object.entries(PAGE_SIZES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button className="primary" type="submit">+ Tạo truyện</button>
      </form>
      {error && <p className="error">{error}</p>}

      {projects.length === 0 ? (
        <p className="muted">Chưa có truyện nào. Hãy tạo nhân vật trước, rồi tạo truyện mới.</p>
      ) : (
        <div className="list">
          {projects.map((p) => (
            <div key={p.id} className="card row between">
              <button className="link grow left" onClick={() => onOpen(p.id)}>
                <strong>{p.title}</strong> <span className={`badge ${p.publishStatus}`}>{statusLabel(p.publishStatus)}</span>
                <span className="muted small">
                  {' '}· {PAGE_SIZES[p.orientation]?.label} · {p.slideCount} ảnh · {new Date(p.updatedAt).toLocaleString('vi-VN')}
                </span>
              </button>
              <button className="danger" onClick={() => remove(p)}>Xoá</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
