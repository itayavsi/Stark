import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`;
  return cfg;
});

// Auth
export const login = (username, password) =>
  api.post('/auth/login', { username, password }).then(r => r.data);

// Quests
export const getQuests = (params = {}) =>
  api.get('/quests/', { params }).then(r => r.data);

export const createQuest = (data) =>
  api.post('/quests/', data).then(r => r.data);

export const takeQuest = (quest_id, username) =>
  api.post('/quests/take', { quest_id, username }).then(r => r.data);

export const completeQuest = (quest_id) =>
  api.post('/quests/complete', { quest_id }).then(r => r.data);

export const setQuestStatus = (quest_id, status) =>
  api.patch(`/quests/${quest_id}/status`, { status }).then(r => r.data);

// Shapefiles
export const uploadShapefile = (quest_id, file) => {
  const fd = new FormData();
  fd.append('quest_id', quest_id);
  fd.append('file', file);
  return api.post('/shapefiles/upload', fd).then(r => r.data);
};

export const getLayerData = (quest_id) =>
  api.get(`/shapefiles/layer-data/${quest_id}`).then(r => r.data);

export const checkFolder = (path) =>
  api.get('/shapefiles/check-folder', { params: { path } }).then(r => r.data);

// Users
export const getUsers = () =>
  api.get('/users/').then(r => r.data);

export default api;
