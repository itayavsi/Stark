import axios from 'axios';

import { getStoredToken } from '../lib/session';
import type {
  CreateQuestInput,
  LayerDataResponse,
  LoginResponse,
  Quest,
  UploadShapefileResponse,
  User,
} from '../types/domain';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(cfg => {
  const token = getStoredToken();

  if (token) {
    cfg.headers = {
      ...(cfg.headers || {}),
      Authorization: `Bearer ${token}`,
    } as any;
  }

  return cfg;
});

export const login = (username: string, password: string) =>
  api.post<LoginResponse>('/auth/login', { username, password }).then((response) => response.data);

export const getQuests = (params: Record<string, string | number> = {}) =>
  api.get<Quest[]>('/quests/', { params }).then((response) => response.data);

export const createQuest = (data: CreateQuestInput) =>
  api.post<Quest>('/quests/', data).then((response) => response.data);

export const takeQuest = (questId: number, username: string) =>
  api.post('/quests/take', { quest_id: questId, username }).then((response) => response.data);

export const completeQuest = (questId: number) =>
  api.post('/quests/complete', { quest_id: questId }).then((response) => response.data);

export const setQuestStatus = (questId: number, status: string) =>
  api.patch(`/quests/${questId}/status`, { status }).then((response) => response.data);

export const uploadShapefile = (questId: number, file: File) => {
  const fd = new FormData();
  fd.append('quest_id', String(questId));
  fd.append('file', file);
  return api.post<UploadShapefileResponse>('/shapefiles/upload', fd).then((response) => response.data);
};

export const getLayerData = (questId: number) =>
  api.get<LayerDataResponse>(`/shapefiles/layer-data/${questId}`).then((response) => response.data);

export const checkFolder = (path: string) =>
  api.get('/shapefiles/check-folder', { params: { path } }).then((response) => response.data);

export const getUsers = () =>
  api.get<User[]>('/users/').then((response) => response.data);

export default api;
