import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import CharactersView from './components/characters-view.jsx';
import ProjectList from './components/project-list.jsx';
import ProjectEditor from './components/project-editor.jsx';
import SettingsView from './components/settings-view.jsx';

const TABS = [
  { id: 'projects', label: 'Truyện' },
  { id: 'characters', label: 'Nhân vật' },
  { id: 'settings', label: 'Cài đặt' },
];

export default function App() {
  const [tab, setTab] = useState('projects');
  const [projectId, setProjectId] = useState(null);
  const [characters, setCharacters] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  const loadSettings = useCallback(() => api.getSettings().then(setSettings).catch((e) => setError(e.message)), []);
  useEffect(() => {
    api.listCharacters().then(setCharacters).catch((e) => setError(e.message));
    loadSettings();
  }, [loadSettings]);

  const openTab = (id) => {
    setTab(id);
    setProjectId(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">📖 StoryTools</strong>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id && !projectId ? 'active' : ''}`} onClick={() => openTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {error && <p className="error banner">Không kết nối được server: {error}</p>}
      {settings && !settings.hasApiKey && (
        <p className="warning banner">
          Chưa có Gemini API key. Vào tab <b>Cài đặt</b> hoặc tạo file <code>.env</code> từ <code>.env.example</code>.
        </p>
      )}

      <main className="content">
        {characters === null ? (
          <p className="muted">Đang tải…</p>
        ) : projectId ? (
          <ProjectEditor projectId={projectId} characters={characters} settings={settings} onSettingsChange={loadSettings} onBack={() => setProjectId(null)} />
        ) : tab === 'projects' ? (
          <ProjectList onOpen={setProjectId} />
        ) : tab === 'characters' ? (
          <CharactersView characters={characters} setCharacters={setCharacters} />
        ) : (
          <SettingsView settings={settings} onSaved={loadSettings} />
        )}
      </main>
    </div>
  );
}
