import { useState } from 'react';
import { api, characterImageUrl } from '../api.js';
import { autosaveLabel, useAutosave } from '../hooks/use-autosave.js';

const uid = () => Math.random().toString(36).slice(2, 10);

export default function CharactersView({ characters, setCharacters }) {
  const status = useAutosave(characters, api.saveCharacters);
  const [error, setError] = useState('');

  const update = (id, patch) => setCharacters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const add = () =>
    setCharacters((list) => [...list, { id: uid(), name: `Nhân vật ${list.length + 1}`, description: '', images: [] }]);
  const remove = (c) => {
    if (confirm(`Xoá nhân vật "${c.name}"?`)) setCharacters((list) => list.filter((x) => x.id !== c.id));
  };

  async function upload(id, fileList) {
    setError('');
    try {
      const files = [];
      for (const f of fileList) files.push((await api.uploadCharacterImage(f)).file);
      setCharacters((list) => list.map((c) => (c.id === id ? { ...c, images: [...(c.images || []), ...files] } : c)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <div className="row between">
        <h2>Nhân vật</h2>
        <div className="row">
          <span className="muted small">{autosaveLabel(status)}</span>
          <button className="primary" onClick={add}>+ Thêm nhân vật</button>
        </div>
      </div>
      <p className="muted small">
        Mô tả cố định sẽ được chèn vào mọi prompt. Viết thật cụ thể (tuổi, tóc, mắt, trang phục, màu sắc). Ảnh tham chiếu: 1–3 ảnh rõ mặt, nền đơn giản.
      </p>
      {error && <p className="error">{error}</p>}
      {characters.length === 0 && <p className="muted">Chưa có nhân vật nào.</p>}

      <div className="grid">
        {characters.map((c) => (
          <div key={c.id} className="card stack">
            <div className="row">
              <input className="grow" value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} placeholder="Tên" />
              <button className="danger" onClick={() => remove(c)}>Xoá</button>
            </div>
            <textarea
              rows={4}
              value={c.description}
              onChange={(e) => update(c.id, { description: e.target.value })}
              placeholder="VD: cậu bé 13 tuổi, tóc đen rối xù, mắt to nâu, áo polo vàng mù tạt, tạp dề vải xanh rêu, quần jean xanh, giày vải đỏ"
            />
            <div className="thumbs">
              {(c.images || []).map((file) => (
                <div key={file} className="thumb-wrap">
                  <img src={characterImageUrl(file)} alt="" />
                  <button
                    className="thumb-remove"
                    title="Bỏ ảnh"
                    onClick={() => update(c.id, { images: c.images.filter((f) => f !== file) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="thumb-add" title="Thêm ảnh tham chiếu">
                +
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    upload(c.id, [...e.target.files]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
