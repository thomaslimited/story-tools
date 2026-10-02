// Thin fetch wrapper for the local API. Errors surface the server's Vietnamese message.

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body instanceof FormData || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

const uploadFile = (url, file) => {
  const form = new FormData();
  form.append('file', file);
  return request('POST', url, form);
};

export const api = {
  getSettings: () => request('GET', '/api/settings'),
  saveSettings: (s) => request('PUT', '/api/settings', s),
  listModels: () => request('GET', '/api/models'),

  listCharacters: () => request('GET', '/api/characters'),
  saveCharacters: (list) => request('PUT', '/api/characters', list),
  uploadCharacterImage: (file) => uploadFile('/api/characters/images', file),

  listProjects: () => request('GET', '/api/projects'),
  createProject: (data) => request('POST', '/api/projects', data),
  getProject: (id) => request('GET', `/api/projects/${id}`),
  saveProject: (p) => request('PUT', `/api/projects/${p.id}`, p),
  deleteProject: (id) => request('DELETE', `/api/projects/${id}`),

  generateFrames: (id, body) => request('POST', `/api/projects/${id}/slides/script`, body),
  planStory: (id, body) => request('POST', `/api/projects/${id}/story/plan`, body),
  placeBubbles: (id, body) => request('POST', `/api/projects/${id}/frames/bubbles`, body),
  generateImage: (id, body) => request('POST', `/api/projects/${id}/images/generate`, body),
  uploadPanelImage: (id, file) => uploadFile(`/api/projects/${id}/images/upload`, file),
  generateCaption: (id, body) => request('POST', `/api/projects/${id}/caption`, body),

  getShare: () => request('GET', '/api/share'),
  startShare: (form) => request('POST', '/api/share', form),
  stopShare: () => request('DELETE', '/api/share'),
};

export const characterImageUrl = (file) => `/files/characters/${file}`;
export const panelImageUrl = (projectId, file) => `/files/panels/${projectId}/${file}`;
