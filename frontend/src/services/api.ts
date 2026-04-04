import axios from 'axios';

import { getStoredToken } from '../lib/session';
import type {
  CreateExternalQuestInput,
  CreateQuestInput,
  GeometryCatalog,
  LoginResponse,
  Quest,
  QuestGeometryRecord,
  User,
  UserCreateInput,
  UserUpdateInput,
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

export const createExternalQuest = (data: CreateExternalQuestInput) =>
  api.post<Quest>('/quests/external', data).then((response) => response.data);

export const takeQuest = (questId: string, username: string) =>
  api.post('/quests/take', { quest_id: questId, username }).then((response) => response.data);

export const completeQuest = (questId: string) =>
  api.post('/quests/complete', { quest_id: questId }).then((response) => response.data);

const encodeQuestId = (questId: string) => encodeURIComponent(questId);

export const setQuestStatus = (questId: string, status: string) =>
  api.patch(`/quests/${encodeQuestId(questId)}/status`, { status }).then((response) => response.data);

export const setQuestPriority = (questId: string, priority: string) =>
  api.patch(`/quests/${encodeQuestId(questId)}/priority`, { priority }).then((response) => response.data);

export const updateQuest = (questId: string, data: Partial<Quest>) =>
  api.patch<Quest>(`/quests/${encodeQuestId(questId)}`, data).then((response) => response.data);

export const uploadQuestPointsGeometry = (questId: string, file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api
    .post<QuestGeometryRecord>(`/geometry/quests/${encodeQuestId(questId)}/points-upload`, fd)
    .then((response) => response.data);
};

export const transferExternalQuestToOpen = (questId: string) =>
  api.post<Quest>(`/quests/${encodeQuestId(questId)}/transfer-to-open`).then((response) => response.data);

export const getGeometryCatalog = () =>
  api.get<GeometryCatalog>('/geometry/catalog').then((response) => response.data);

export const getQuestGeometry = (questId: string) =>
  api.get<QuestGeometryRecord>(`/geometry/quests/${encodeQuestId(questId)}`).then((response) => response.data);

export const saveQuestPointGeometry = (questId: string, utm: string) =>
  api.put<QuestGeometryRecord>(`/geometry/quests/${encodeQuestId(questId)}/point`, { utm }).then((response) => response.data);

export const deleteQuestPointGeometry = (questId: string) =>
  api.delete<QuestGeometryRecord>(`/geometry/quests/${encodeQuestId(questId)}/point`).then((response) => response.data);

export const uploadQuestPolygonGeometry = (questId: string, files: File[]) => {
  const fd = new FormData();

  files.forEach((file) => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    fd.append('files', file, relativePath);
  });

  return api
    .post<QuestGeometryRecord>(`/geometry/quests/${encodeQuestId(questId)}/polygon-upload`, fd)
    .then((response) => response.data);
};

export const deleteQuestPolygonGeometry = (questId: string) =>
  api.delete<QuestGeometryRecord>(`/geometry/quests/${encodeQuestId(questId)}/polygon`).then((response) => response.data);

export const completeQuestWithAccuracy = (questId: string, accuracy_xy: number, accuracy_z: number) =>
  api.post<QuestGeometryRecord>(`/geometry/quests/${encodeQuestId(questId)}/complete`, { accuracy_xy, accuracy_z }).then((response) => response.data);

export const getFinishedGeometryCatalog = () =>
  api.get<GeometryCatalog>('/geometry/finished-catalog').then((response) => response.data);

export const getUsers = () =>
  api.get<User[]>('/users/').then((response) => response.data);

export const createUser = (data: UserCreateInput) =>
  api.post<User>('/users/', data).then((response) => response.data);

export const updateUser = (userId: string, data: UserUpdateInput) =>
  api.patch<User>(`/users/${userId}`, data).then((response) => response.data);

export const deleteUser = (userId: string) =>
  api.delete<{ status: string; user_id: string }>(`/users/${userId}`).then((response) => response.data);

export default api;
