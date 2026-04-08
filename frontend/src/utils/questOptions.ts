import type { MatziahOption, QuestPriority } from '../types/domain';
import {
  QUEST_STATUS_OPTIONS,
  type QuestStatusOption,
  DEFAULT_QUEST_STATUS,
} from '../config/questTableColumns';

export { QUEST_STATUS_OPTIONS };

export const QUICK_CREATE_STATUS_OPTIONS: QuestStatusOption[] = QUEST_STATUS_OPTIONS.filter(
  (option) => option.category === 'start'
);

export const DEFAULT_STATUS = DEFAULT_QUEST_STATUS;

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
