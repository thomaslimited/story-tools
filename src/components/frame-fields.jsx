// Editable script fields of one frame: scene, action, expression, cast and dialogues.

const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export default function FrameFields({ frame, title, cast, updateFrame }) {
  // Editing dialogues resets bubbles so the dialogue step re-places them from the new text.
  const setDialogues = (fn) => updateFrame(frame.id, (f) => ({ dialogues: fn(f.dialogues), bubbles: null }));

  return (
    <div className="frame-box stack">
      {title && <strong className="small">{title}</strong>}
      <div className="fields-grid">
        <label>
          Bối cảnh
          <textarea rows={2} value={frame.scene} onChange={(e) => updateFrame(frame.id, { scene: e.target.value })} />
        </label>
        <label>
          Hành động
          <textarea rows={2} value={frame.action} onChange={(e) => updateFrame(frame.id, { action: e.target.value })} />
        </label>
        <label>
          Biểu cảm
          <textarea rows={2} value={frame.expression} onChange={(e) => updateFrame(frame.id, { expression: e.target.value })} />
        </label>
      </div>

      <div className="chips">
        <span className="label">Xuất hiện:</span>
        {cast.map((c) => (
          <button
            key={c.id}
            className={`chip ${frame.characterIds.includes(c.id) ? 'active' : ''}`}
            onClick={() => updateFrame(frame.id, (f) => ({ characterIds: toggle(f.characterIds, c.id) }))}
          >
            {c.name}
          </button>
        ))}
        {!cast.length && <span className="muted small">Chọn nhân vật trong phần Thiết lập truyện</span>}
      </div>

      <div className="stack tight">
        <span className="label">Lời thoại</span>
        {frame.dialogues.map((d, di) => (
          <div key={di} className="row">
            <select
              value={d.speakerId || ''}
              onChange={(e) => setDialogues((list) => list.map((x, k) => (k === di ? { ...x, speakerId: e.target.value || null } : x)))}
            >
              <option value="">(Không rõ)</option>
              {cast.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              className="grow"
              value={d.text}
              onChange={(e) => setDialogues((list) => list.map((x, k) => (k === di ? { ...x, text: e.target.value } : x)))}
            />
            <button onClick={() => setDialogues((list) => list.filter((_, k) => k !== di))}>×</button>
          </div>
        ))}
        <div>
          <button onClick={() => setDialogues((list) => [...list, { speakerId: frame.characterIds[0] || null, text: '' }])}>
            + Lời thoại
          </button>
        </div>
      </div>
    </div>
  );
}
