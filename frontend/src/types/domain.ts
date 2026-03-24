export type UserRole = 'Team Leader' | 'User' | 'Viewer';

export interface User {
  username: string;
  role: UserRole;
  display_name?: string;
  group?: string;
}

export type QuestStatus =
  | 'Open'
  | 'Taken'
  | 'In Progress'
  | 'Done'
  | 'Approved'
  | 'Stopped'
  | 'Cancelled';

export type FtOption = 'FT1' | 'FT2' | 'FT3' | 'FT4' | 'FT5';

export interface Quest {
  id: string;
  title: string;
  description?: string;
  ft?: FtOption | string;
  status: QuestStatus | string;
  date?: string;
  assigned_user?: string;
  year?: number;
  group?: string;
  lng?: number;
  lat?: number;
  shapefile_path?: string;
  sync_source?: string;
  sync_name?: string;
  external_status?: string;
}

export interface LoginResponse {
  token?: string;
  user: User;
}

export interface CreateQuestInput {
  title: string;
  description?: string;
  year?: number;
  ft?: FtOption | string;
  group?: string;
  shapefile_path?: string;
}

export interface GeoGeometry {
  type: string;
  coordinates: unknown;
}

export interface GeoFeature {
  id?: string | number;
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry?: GeoGeometry;
}

export interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface UploadedLayerPayload {
  name?: string;
  geojson?: GeoFeatureCollection;
  data?: GeoFeatureCollection;
  fields?: string[];
  type?: string;
}

export interface AppLayer {
  id?: string;
  name: string;
  data?: GeoFeatureCollection;
  geojson?: GeoFeatureCollection;
  fields: string[];
  year?: number;
  ft?: FtOption | string;
  type?: string;
  visible?: boolean;
}

export interface LayerDataResponse {
  layers?: UploadedLayerPayload[];
}

export interface UploadShapefileResponse {
  status?: string;
  error?: string;
  layers?: UploadedLayerPayload[];
}

export interface ResolveShpFolderResponse {
  path: string;
  shapefile_path: string;
}

export interface LngLatPoint {
  lng: number;
  lat: number;
}

export type MapBounds = [[number, number], [number, number]];

export interface QuestSortOrderResponse {
  group: string;
  view: string;
  quest_ids: string[];
}
