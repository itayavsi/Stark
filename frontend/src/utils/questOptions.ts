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

export const DEFAULT_PRIORITY: QuestPriority = 'ב';

export const QUEST_PRIORITY_OPTIONS: Array<{ value: QuestPriority | string; label: string }> = [
  { value: 'א+', label: 'א+' },
  { value: 'א', label: 'א' },
  { value: 'ב', label: 'ב' },
  { value: 'ג', label: 'ג' },
  { value: 'ד', label: 'ד' },
  { value: 'ה', label: 'ה' },
  { value: 'deadline', label: 'זמן מוגדר' },
];

export const EXTERNAL_QUEST_PRIORITY_OPTIONS: Array<{ value: QuestPriority | string; label: string }> = [
  { value: '', label: 'ללא תעדוף' },
  ...QUEST_PRIORITY_OPTIONS,
];

export function getPriorityLabel(priority: string | undefined): string {
  const normalized = String(priority || '').trim();
  if (!normalized) return 'ללא תעדוף';
  return QUEST_PRIORITY_OPTIONS.find((option) => option.value === normalized)?.label || normalized;
}

export function isHighPriorityValue(priority: string | undefined): boolean {
  const normalized = String(priority || '').trim();
  return normalized === 'א+' || normalized === 'א' || normalized === 'גבוה';
}

export function isLowPriorityValue(priority: string | undefined): boolean {
  const normalized = String(priority || '').trim().toLowerCase();
  return (
    normalized === 'ד' ||
    normalized === 'ה' ||
    normalized === 'נמוך' ||
    normalized === 'low' ||
    normalized === 'low priority'
  );
}

export function isDeadlinePriorityValue(priority: string | undefined): boolean {
  return String(priority || '').trim() === 'deadline';
}

export const MATZIAH_OPTIONS: Array<{ value: MatziahOption; label: string; hint: string }> = [
  { value: 'Nezah', label: 'נצח', hint: 'מסנכרן סטטוס מול המשימה החיצונית' },
  { value: 'Medidot', label: 'Medidot', hint: 'תהליך בתצוגה זמנית' },
  { value: 'Azarim', label: 'Azarim', hint: 'תהליך בתצוגה זמנית' },
];

export function getMatziahHint(value: MatziahOption | string | undefined): string {
  const key = getMatziahSelectValue(value);
  return MATZIAH_OPTIONS.find((option) => option.value === key)?.hint || '';
}

export function getMatziahLabel(value: MatziahOption | string | undefined): string {
  if (!value) return '—';
  const key = getMatziahSelectValue(value);
  return MATZIAH_OPTIONS.find((option) => option.value === key)?.label || String(value);
}

export function isNezahMatziah(value: MatziahOption | string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'nezah' || normalized === 'n';
}

export function getMatziahSelectValue(value: MatziahOption | string | undefined): MatziahOption {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'n' || normalized === 'nezah') return 'Nezah';
  if (normalized === 'm' || normalized === 'medidot') return 'Medidot';
  if (normalized === 'h' || normalized === 'azarim') return 'Azarim';
  return 'Nezah';
}

export function toLegacyMatziahCode(value: MatziahOption | string | undefined): 'N' | 'M' | 'H' {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'm' || normalized === 'medidot') return 'M';
  if (normalized === 'h' || normalized === 'azarim') return 'H';
  return 'N';
}
