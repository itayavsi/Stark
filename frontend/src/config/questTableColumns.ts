import type { Quest } from '../types/domain';

export type AttributeColumnKey = keyof Quest | 'geometry_summary' | 'accuracy_xy' | 'accuracy_z';

export interface AttributeColumn {
  key: AttributeColumnKey;
  label: string;
  editable?: boolean;
}

export type AttributeTableViewMode = 'all' | 'active' | 'finished';

// # Open quests (Attribute Table) columns: add/remove/change here
export const ATTRIBUTE_TABLE_COLUMNS_ACTIVE: AttributeColumn[] = [
  { key: 'title', label: 'כותרת', editable: true },
  { key: 'quest_type', label: 'סוג משימה' },
  { key: 'status', label: 'סטטוס', editable: true },
  { key: 'priority', label: 'תעדוף', editable: true },
  { key: 'group', label: 'קבוצה', editable: true },
  { key: 'year', label: 'שנה', editable: true },
  { key: 'assigned_user', label: 'משויך', editable: true },
  { key: 'date', label: 'תאריך', editable: true },
  { key: 'notes', label: 'הערות', editable: true },
  { key: 'model_folder', label: 'Model Folder' },
  { key: 'geometry_type', label: 'סוג גיאומטריה' },
  { key: 'geometry_status', label: 'סטטוס גיאומטריה' },
  { key: 'geometry_summary', label: 'מקור / מידע' },
];

// # Finished quests (Attribute Table) columns: add/remove/change here
export const ATTRIBUTE_TABLE_COLUMNS_FINISHED: AttributeColumn[] = [
  { key: 'title', label: 'כותרת', editable: true },
  { key: 'quest_type', label: 'סוג משימה', editable: true },
  { key: 'status', label: 'סטטוס', editable: true },
  { key: 'priority', label: 'תעדוף', editable: true },
  { key: 'group', label: 'קבוצה', editable: true },
  { key: 'year', label: 'שנה', editable: true },
  { key: 'assigned_user', label: 'משויך', editable: true },
  { key: 'date', label: 'תאריך', editable: true },
  { key: 'notes', label: 'הערות', editable: true },
  { key: 'model_folder', label: 'Model Folder' },
  { key: 'geometry_type', label: 'סוג גיאומטריה' },
  { key: 'accuracy_xy', label: 'דיוק XY (ס"מ)' },
  { key: 'accuracy_z', label: 'דיוק Z (ס"מ)' },
  { key: 'geometry_summary', label: 'מקור / מידע' },
];

// # All quests (Attribute Table) columns: add/remove/change here
export const ATTRIBUTE_TABLE_COLUMNS_ALL: AttributeColumn[] = [
  { key: 'title', label: 'כותרת', editable: true },
  { key: 'quest_type', label: 'סוג משימה', editable: true },
  { key: 'status', label: 'סטטוס', editable: true },
  { key: 'priority', label: 'תעדוף', editable: true },
  { key: 'group', label: 'קבוצה', editable: true },
  { key: 'year', label: 'שנה', editable: true },
  { key: 'assigned_user', label: 'משויך', editable: true },
  { key: 'date', label: 'תאריך', editable: true },
  { key: 'notes', label: 'הערות', editable: true },
  { key: 'model_folder', label: 'Model Folder' },
  { key: 'geometry_type', label: 'סוג גיאומטריה' },
  { key: 'geometry_status', label: 'סטטוס גיאומטריה' },
  { key: 'accuracy_xy', label: 'דיוק XY (ס"מ)' },
  { key: 'accuracy_z', label: 'דיוק Z (ס"מ)' },
  { key: 'geometry_summary', label: 'מקור / מידע' },
];

// # Default column widths (Attribute Table): add width for new column key here
export const ATTRIBUTE_TABLE_DEFAULT_COL_WIDTHS: Record<string, number> = {
  actions: 140,
  title: 200,
  quest_type: 100,
  status: 100,
  priority: 80,
  group: 100,
  year: 70,
  assigned_user: 120,
  date: 100,
  notes: 200,
  model_folder: 160,
  geometry_type: 100,
  geometry_status: 100,
  geometry_summary: 150,
  accuracy_xy: 100,
  accuracy_z: 100,
};

// # SQL filter fields (Attribute Table): add/remove columns here if needed
export const ATTRIBUTE_TABLE_SQL_FIELDS = ATTRIBUTE_TABLE_COLUMNS_ACTIVE.filter(
  (col) => col.key !== 'geometry_summary',
);

export const getAttributeTableColumns = (mode: AttributeTableViewMode): AttributeColumn[] => {
  switch (mode) {
    case 'finished':
      return ATTRIBUTE_TABLE_COLUMNS_FINISHED;
    case 'active':
      return ATTRIBUTE_TABLE_COLUMNS_ACTIVE;
    default:
      return ATTRIBUTE_TABLE_COLUMNS_ALL;
  }
};

// # Quest panel (Excel table) columns: add/remove/change here
export const ALL_QUEST_COLUMNS = ['#', 'כותרת', 'FT', 'סטטוס', 'תאריך', 'משתמש', 'תיאור', 'שנה'] as const;

// # Quest panel sort mapping: add new column mapping here
export const QUEST_PANEL_SORT_KEY_BY_COLUMN: Record<(typeof ALL_QUEST_COLUMNS)[number], keyof Quest | 'id'> = {
  '#': 'id',
  'כותרת': 'title',
  FT: 'ft',
  'סטטוס': 'status',
  'תאריך': 'date',
  'משתמש': 'assigned_user',
  'תיאור': 'description',
  'שנה': 'year',
};
