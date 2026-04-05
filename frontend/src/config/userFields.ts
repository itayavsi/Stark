export type UserFieldKey = 'display_name' | 'username' | 'password' | 'group' | 'role';
export type UserFieldType = 'text' | 'password' | 'select';

export interface UserFieldConfig {
  key: UserFieldKey;
  label: string;
  placeholder?: string;
  type: UserFieldType;
}

// # Users TB (Create form) fields: add/remove/change here
export const USER_CREATE_FIELDS: UserFieldConfig[] = [
  { key: 'display_name', label: 'שם מלא', placeholder: 'שם מלא', type: 'text' },
  { key: 'username', label: 'שם משתמש', placeholder: 'שם משתמש', type: 'text' },
  { key: 'password', label: 'סיסמה', placeholder: 'סיסמה', type: 'password' },
  { key: 'group', label: 'קבוצה', placeholder: 'קבוצה', type: 'text' },
  { key: 'role', label: 'הרשאה', type: 'select' },
];

// # Users TB (Edit form) fields: add/remove/change here
export const USER_EDIT_FIELDS: UserFieldConfig[] = [
  { key: 'display_name', label: 'שם מלא', placeholder: 'שם מלא', type: 'text' },
  { key: 'group', label: 'קבוצה', placeholder: 'קבוצה', type: 'text' },
  { key: 'role', label: 'הרשאה', type: 'select' },
  { key: 'password', label: 'סיסמה חדשה', placeholder: 'סיסמה חדשה (אופציונלי)', type: 'password' },
];
