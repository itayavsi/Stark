import type { Quest } from '../types/domain';

export type AttributeColumnKey = keyof Quest | 'geometry_summary' | 'accuracy_xy' | 'accuracy_z';

export interface AttributeColumn {
  key: AttributeColumnKey;
  label: string;
  editable?: boolean;
}

export type AttributeTableViewMode = 'all' | 'open' | 'paused' | 'low' | 'finished';

// # Open quests (Attribute Table) columns: add/remove/change here
export const ATTRIBUTE_TABLE_COLUMNS_ACTIVE: AttributeColumn[] = [
  { key: 'title', label: 'כותרת', editable: true },
  { key: 'quest_type', label: 'סוג משימה' },
  { key: 'status', label: 'סטטוס', editable: true },
  { key: 'priority', label: 'תעדוף', editable: true },
  { key: 'group', label: 'קבוצה', editable: true },
  { key: 'year', label: 'שנה', editable: true },
  { key: 'assigned_user', label: 'שם פותר', editable: true },
  { key: 'date', label: 'תאריך', editable: true },
  { key: 'notes', label: 'הערות', editable: true },
  { key: 'model_simulations', label: 'הדמאות למודלים', editable: true },
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
  { key: 'assigned_user', label: 'שם פותר', editable: true },
  { key: 'date', label: 'תאריך', editable: true },
  { key: 'notes', label: 'הערות', editable: true },
  { key: 'model_simulations', label: 'הדמאות למודלים', editable: true },
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
  { key: 'assigned_user', label: 'שם פותר', editable: true },
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
  model_simulations: 200,
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
    case 'open':
    case 'paused':
    case 'low':
      return ATTRIBUTE_TABLE_COLUMNS_ACTIVE;
    default:
      return ATTRIBUTE_TABLE_COLUMNS_ALL;
  }
};

export type QuestPanelColumnKey = keyof Quest | 'id';

export interface QuestPanelColumn {
  key: QuestPanelColumnKey;
  label: string;
}

// # Quest panel (Excel table) columns: add/remove/change here
export const QUEST_PANEL_COLUMNS: QuestPanelColumn[] = [
  { key: 'id', label: '#' },
  { key: 'title', label: 'כותרת' },
  { key: 'ft', label: 'FT' },
  { key: 'status', label: 'סטטוס' },
  { key: 'priority', label: 'תעדוף' },
  { key: 'date', label: 'תאריך' },
  { key: 'assigned_user', label: 'שם פותר' },
  { key: 'zarhan_notes', label: 'הערות מהצרכן' },
  { key: 'model_simulations', label: 'הדמאות למודלים' },
  { key: 'notes', label: 'הערות' },
  { key: 'model_folder', label: 'Model Folder' },
];

// # Quest panel default widths: add width for new column key here
export const QUEST_PANEL_DEFAULT_COL_WIDTHS: Partial<Record<QuestPanelColumnKey, number>> = {
  id: 60,
  title: 220,
  ft: 90,
  status: 140,
  priority: 140,
  date: 110,
  assigned_user: 140,
  zarhan_notes: 260,
  model_simulations: 220,
  notes: 220,
  model_folder: 200,
};

export const ALL_QUEST_COLUMNS = QUEST_PANEL_COLUMNS.map((col) => col.label) as readonly string[];

export type QuestStatusCategory = 'start' | 'regular' | 'paused' | 'finished' | 'on_hold';

export interface QuestStatusOption {
  value: string;
  label: string;
  category: QuestStatusCategory;
  isDefault?: boolean;
}

// # Status options (for dropdowns/labels): add/remove/change here
export const QUEST_STATUS_OPTIONS: QuestStatusOption[] = [
  { value: 'Start', label: 'ממתין לתחילת עבודה', category: 'start', isDefault: true },
  { value: 'Search', label: 'חיפוש חומר גלם', category: 'regular' },
  { value: 'Production', label: 'הפקה', category: 'regular' },
  { value: 'Solve', label: 'פתרון', category: 'regular' },
  { value: 'MBT_solve', label: 'MBTפתרון ב', category: 'regular' },
  { value: 'Tiyuv', label: 'טיוב', category: 'regular' },
  { value: 'acc_test', label: 'בדיקת דיוקים', category: 'regular' },
  { value: 'Kilta', label: 'הצהרת דיוק וקליטה', category: 'regular' },
  { value: 'Paused', label: 'הופסק', category: 'paused' },
  { value: 'Finished', label: 'סוים', category: 'finished' },
  { value: 'Ziyuah_mipuy', label: 'צויח ליחמפ', category: 'on_hold' },
  { value: 'Klita_mipuy', label: 'קליטה יחמפ', category: 'regular' },
  { value: 'MQA', label: 'בדיקת MQA', category: 'regular' },
  { value: 'BDB', label: 'צריך BDB', category: 'regular' },
  { value: 'QL', label: 'QLממתין ל', category: 'on_hold' },
  { value: 'BDB_hold', label: 'BDBממתין ל', category: 'on_hold' },
  { value: 'need_ziyuah', label: 'יש לצייח לצילום', category: 'regular' },
  { value: 'hold_ziyuah', label: 'צויח לצילום', category: 'on_hold' },
  { value: 'Snow_ziyuah', label: 'צויח לצילום הוקפא בגלל שלג', category: 'paused' },
  { value: 'Need_Nezah', label: 'נדרש אישור נצח', category: 'regular' },
  { value: 'Approved_Nezah', label: 'מאושר נצח', category: 'regular' },
];

export const DEFAULT_QUEST_STATUS =
  QUEST_STATUS_OPTIONS.find((opt) => opt.isDefault)?.value ?? QUEST_STATUS_OPTIONS[0]?.value ?? 'Start';
