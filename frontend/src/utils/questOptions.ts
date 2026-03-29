import type { MatziahOption, QuestPriority, QuestStatus } from '../types/domain';

export const QUEST_STATUS_OPTIONS: Array<{ value: QuestStatus | string; label: string }> = [
  { value: 'Open', label: 'פתוח' },
  { value: 'Taken', label: 'נלקח' },
  { value: 'In Progress', label: 'בביצוע' },
  { value: 'ממתין', label: 'ממתין' },
  { value: 'Done', label: 'הושלם' },
  { value: 'Approved', label: 'מאושר' },
  { value: 'Stopped', label: 'הופסק' },
  { value: 'Cancelled', label: 'בוטל' },
];

export const QUICK_CREATE_STATUS_OPTIONS = QUEST_STATUS_OPTIONS.filter(
  (option) => option.value === 'Open' || option.value === 'ממתין'
);

export const QUEST_PRIORITY_OPTIONS: Array<{ value: QuestPriority | string; label: string }> = [
  { value: 'גבוה', label: 'תעדוף גבוה' },
  { value: 'רגיל', label: 'תעדוף רגיל' },
  { value: 'נמוך', label: 'תעדוף נמוך' },
];

export const MATZIAH_OPTIONS: Array<{ value: MatziahOption; label: string; hint: string }> = [
  { value: 'N', label: 'N', hint: 'מסנכרן סטטוס מול המשימה החיצונית' },
  { value: 'H', label: 'H', hint: 'שומר את המשימה פנימית ללא סנכרון חיצוני' },
  { value: 'M', label: 'M', hint: 'מצב ידני ללא סנכרון אוטומטי' },
];

export function getMatziahHint(value: MatziahOption | string | undefined): string {
  return MATZIAH_OPTIONS.find((option) => option.value === value)?.hint || '';
}
