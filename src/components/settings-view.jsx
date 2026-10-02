import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ImageModelSelect from './image-model-select.jsx';

// Fallback suggestions when the model list can't be fetched (no key yet or offline).
const FALLBACK_MODELS = {
  text: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.1-pro-preview'],
  image: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-3.1-flash-lite-image'],
};

export default function SettingsView({ settings, onSaved }) {
  const [apiKey, setApiKey] = useState('');
  const [textModel, setTextModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [modelsNote, setModelsNote] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!settings) return;
    setTextModel(settings.textModel);
    setImageModel(settings.imageModel);
    if (!settings.hasApiKey) return;
    api
      .listModels()
      .then((list) => {
        setModels(list);
        setModelsNote(`Danh sách lấy từ API key của bạn (${list.text.length} model text, ${list.image.length} model ảnh).`);
      })
      .catch((err) => setModelsNote(`Không lấy được danh sách model: ${err.message}`));
  }, [settings]);

  async function save(e) {
    e.preventDefault();
    try {
      await api.saveSettings({ apiKey, textModel, imageModel });
      setApiKey('');
      setMessage('Đã lưu cài đặt.');
      onSaved();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <form className="card narrow stack" onSubmit={save}>
      <h2>Cài đặt Gemini</h2>
      <label>
        API key {settings?.hasApiKey && <span className="muted">(đang dùng key {settings.apiKeyHint}, để trống nếu không đổi)</span>}
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza…" autoComplete="off" />
      </label>
      <label>
        Model viết kịch bản, caption, đặt lời thoại
        <input list="text-models" value={textModel} onChange={(e) => setTextModel(e.target.value)} />
      </label>
      <ImageModelSelect value={imageModel} onChange={setImageModel} stacked />
      <datalist id="text-models">{models.text.map((m) => <option key={m} value={m} />)}</datalist>
      <p className="muted small">
        {modelsNote} Model đời cũ (VD <code>gemini-2.5-*</code>) có thể vẫn hiện trong danh sách nhưng bị khoá với tài khoản mới – nên chọn bản mới nhất.
      </p>
      <p className="muted small">
        Key được lưu cục bộ trong <code>data/settings.json</code> (đã gitignore). Model ảnh Gemini không có free tier – mỗi lần tạo đều tính phí.
      </p>
      <div className="row">
        <button className="primary" type="submit">Lưu</button>
        {message && <span className="muted">{message}</span>}
      </div>
    </form>
  );
}
