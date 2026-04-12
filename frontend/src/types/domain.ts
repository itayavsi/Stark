export type UserRole = 'Team Leader' | 'User' | 'Viewer';

export interface User {
  id?: string;
  username: string;
  role: UserRole;
  display_name?: string;
  group?: string;
}

export interface UserCreateInput {
  username: string;
  password: string;
  role: UserRole;
  group?: string;
  display_name?: string;
}

export interface UserUpdateInput {
  display_name?: string;
  role?: UserRole;
  group?: string;
  password?: string;
}

export type QuestStatus =
  | 'Start'
  | 'Search'
  | 'Production'
  | 'Solve'
  | 'MBT_solve'
  | 'Tiyuv'
  | 'acc_test'
  | 'Kilta'
  | 'Paused'
  | 'Finished'
  | 'Ziyuah_mipuy'
  | 'Klita_mipuy'
  | 'MQA'
  | 'BDB'
  | 'QL'
  | 'BDB_hold'
  | 'need_ziyuah'
  | 'hold_ziyuah'
  | 'Snow_ziyuah'
  | 'Need_Nezah'
  | 'Approved_Nezah';

export type QuestPriority = 'א+' | 'א' | 'ב' | 'ג' | 'ד' | 'ה' | 'deadline';

export type FtOption = string;

export type MatziahOption = 'N' | 'H' | 'M';
export type GeometryType = 'point' | 'polygon';
export type GeometryStatus = 'missing' | 'pending' | 'ready' | 'error';

export interface Quest {
  id: string;
  title: string;
  description?: string;
  notes?: string;
  ft?: FtOption | string;
  quest_type?: FtOption | string;
  status: QuestStatus | string;
  priority?: QuestPriority | string;
  isNew?: boolean;
  date?: string;
  entry_date?: string;
  finished_date?: string | null;
  deadline_at?: string | null;
  assigned_user?: string;
  year?: number;
  group?: string;
  target_type?: string;
  country?: string;
  zarhan_notes?: string;
  user_priority?: string;
  duo_to_use?: string;
  ground_point?: string;
  solve_strategy?: string;
  lng?: number;
  lat?: number;
  shapefile_path?: string;
  model_simulations?: string | null;
  model_folder?: string | null;
  matziah?: MatziahOption | string;
  sync_external_id?: string;
  sync_source?: string;
  sync_name?: string;
  external_status?: string;
  isTransferred?: boolean;
  transferred_quest_id?: string;
  geometry_type?: GeometryType | GeometryType[] | null;
  geometry_status?: GeometryStatus | string;
  geometry_source_path?: string | null;
  geometry_source_name?: string | null;
  geometry_feature_count?: number;
  geometry_updated_at?: string | null;
  has_point?: boolean;
  has_polygon?: boolean;
}

export interface LoginResponse {
  token?: string;
  user: User;
}

export interface CreateQuestInput {
  title: string;
  description?: string;
  status?: QuestStatus | string;
  priority?: QuestPriority | string;
  date?: string;
  entry_date?: string;
  finished_date?: string | null;
  deadline_at?: string | null;
  assigned_user?: string;
  year?: number;
  ft?: FtOption | string;
  quest_type?: FtOption | string;
  target_type?: string;
  country?: string;
  zarhan_notes?: string;
  user_priority?: string;
  duo_to_use?: string;
  ground_point?: string;
  solve_strategy?: string;
  group?: string;
  shapefile_path?: string;
  model_simulations?: string | null;
  model_folder?: string | null;
  matziah?: MatziahOption | string;
  sync_external_id?: string;
  sync_source?: string;
  sync_name?: string;
}

export interface CreateExternalQuestInput {
  title: string;
  description?: string;
  status?: QuestStatus | string;
  priority?: QuestPriority | string;
  date?: string;
  entry_date?: string;
  finished_date?: string | null;
  deadline_at?: string | null;
  assigned_user?: string;
  year?: number;
  ft?: FtOption | string;
  quest_type?: FtOption | string;
  target_type?: string;
  country?: string;
  zarhan_notes?: string;
  user_priority?: string;
  duo_to_use?: string;
  ground_point?: string;
  solve_strategy?: string;
  group?: string;
  matziah?: MatziahOption | string;
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

export interface GeometryCatalog {
  quest_types: string[];
  points: GeoFeatureCollection;
  polygons: GeoFeatureCollection;
}

export interface QuestGeometryRecord {
  quest_id: string;
  title: string;
  description?: string;
  status: QuestStatus | string;
  priority?: QuestPriority | string;
  date?: string;
  deadline_at?: string | null;
  assigned_user?: string | null;
  group?: string;
  year?: number;
  ft?: FtOption | string;
  quest_type?: FtOption | string;
  matziah?: MatziahOption | string;
  geometry_type?: GeometryType | GeometryType[] | null;
  geometry_status: GeometryStatus | string;
  source_path?: string | null;
  source_name?: string | null;
  upload_kind?: string | null;
  feature_count: number;
  feature_collection?: GeoFeatureCollection | null;
  point_geojson?: GeoFeatureCollection | null;
  polygon_geojson?: GeoFeatureCollection | null;
  point_feature_count?: number;
  polygon_feature_count?: number;
  utm_zone?: number | null;
  utm_band?: string | null;
  utm_easting?: number | null;
  utm_northing?: number | null;
  updated_at?: string | null;
  accuracy_xy?: number | null;
  accuracy_z?: number | null;
}

export interface LayerFilters {
  showPoints: boolean;
  showPolygons: boolean;
  questTypes: Record<string, boolean>;
}

export interface LngLatPoint {
  lng: number;
  lat: number;
}

export type MapBounds = [[number, number], [number, number]];

export interface IdentifiedFeature {
  feature: GeoFeature;
  layerName: string;
  geometryType: 'point' | 'polygon';
}

export interface IdentifyResults {
  location: LngLatPoint;
  features: IdentifiedFeature[];
}
