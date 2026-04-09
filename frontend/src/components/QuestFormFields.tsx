import type { CSSProperties } from 'react';

import { FT_OPTIONS } from '../services/ftConfig';
import type { FtOption, MatziahOption, QuestPriority, QuestStatus } from '../types/domain';
import {
  EXTERNAL_QUEST_PRIORITY_OPTIONS,
  MATZIAH_OPTIONS,
  isDeadlinePriorityValue,
  QUEST_PRIORITY_OPTIONS,
  QUICK_CREATE_STATUS_OPTIONS,
  getMatziahHint,
} from '../utils/questOptions';

export interface QuestFormValue {
  title: string;
  description: string;
  year: number;
  ft: FtOption | string;
  status: QuestStatus | string;
  priority: QuestPriority | string;
  matziah: MatziahOption | string;
  date?: string;
  deadline_at?: string;
  assigned_user?: string;
  group?: string;
}

interface QuestFormFieldsProps {
  value: QuestFormValue;
  onChange: (nextValue: QuestFormValue) => void;
  statusOptions?: Array<{ value: QuestStatus | string; label: string }>;
  allowEmptyPriority?: boolean;
  showDate?: boolean;
  showAssignedUser?: boolean;
  showGroup?: boolean;
}

const YEAR_OPTIONS = [2027, 2026, 2025, 2024, 2023];

export default function QuestFormFields({
  value,
  onChange,
  statusOptions = QUICK_CREATE_STATUS_OPTIONS,
  allowEmptyPriority = false,
  showDate = false,
  showAssignedUser = false,
  showGroup = false,
}: QuestFormFieldsProps) {
  const updateField = <K extends keyof QuestFormValue>(field: K, nextFieldValue: QuestFormValue[K]) => {
    onChange({
      ...value,
      [field]: nextFieldValue,
    });
  };
  const priorityOptions = allowEmptyPriority ? EXTERNAL_QUEST_PRIORITY_OPTIONS : QUEST_PRIORITY_OPTIONS;

  return (
    <>
      <input
        className="input"
        placeholder="כותרת משימה *"
        value={value.title}
        onChange={(event) => updateField('title', event.target.value)}
        required
        style={S.input}
      />
      <textarea
        className="input"
        placeholder="תיאור (אופציונלי)"
        value={value.description}
        onChange={(event) => updateField('description', event.target.value)}
        rows={3}
        style={{ ...S.input, resize: 'vertical', minHeight: 84 }}
      />

      {(showDate || showAssignedUser || showGroup) && (
        <div style={S.grid3}>
          {showDate && (
            <input
              className="input"
              type="date"
              value={value.date || ''}
              onChange={(event) => updateField('date', event.target.value)}
              style={S.input}
            />
          )}
          {showAssignedUser && (
            <input
              className="input"
              placeholder="פותח / משויך"
              value={value.assigned_user || ''}
              onChange={(event) => updateField('assigned_user', event.target.value)}
              style={S.input}
            />
          )}
          {showGroup && (
            <input
              className="input"
              placeholder="קבוצה"
              value={value.group || ''}
              onChange={(event) => updateField('group', event.target.value)}
              style={S.input}
            />
          )}
        </div>
      )}

      <div style={S.grid3}>
        <select
          className="input"
          value={value.year}
          onChange={(event) => updateField('year', Number(event.target.value))}
          style={S.input}
        >
          {YEAR_OPTIONS.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={value.ft}
          onChange={(event) => updateField('ft', event.target.value as FtOption)}
          style={S.input}
        >
          {FT_OPTIONS.map((ft) => (
            <option key={ft} value={ft}>
              {ft}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={value.status}
          onChange={(event) => updateField('status', event.target.value as QuestStatus)}
          style={S.input}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={S.grid2}>
        <select
          className="input"
          value={value.priority}
          onChange={(event) => {
            const nextPriority = event.target.value as QuestPriority | string;
            const nextValue: QuestFormValue = { ...value, priority: nextPriority };

            if (showDate && isDeadlinePriorityValue(nextPriority)) {
              if (!nextValue.deadline_at || !nextValue.deadline_at.includes('T')) {
                const baseDate = (nextValue.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
                nextValue.deadline_at = `${baseDate}T08:00`;
              }
            }

            onChange(nextValue);
          }}
          style={S.input}
        >
          {priorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={value.matziah}
          onChange={(event) => updateField('matziah', event.target.value as MatziahOption)}
          style={S.input}
        >
          {MATZIAH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              מצייח {option.label}
            </option>
          ))}
        </select>
      </div>

      {showDate && isDeadlinePriorityValue(value.priority) && (
        <input
          className="input"
          type="datetime-local"
          value={value.deadline_at || ''}
          onChange={(event) => updateField('deadline_at', event.target.value)}
          style={S.input}
          placeholder="דדליין"
        />
      )}

      <div style={S.hint}>{getMatziahHint(value.matziah)}</div>
    </>
  );
}

const S: Record<string, CSSProperties> = {
  input: {
    fontSize: 13,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },
  hint: {
    fontSize: 11,
    color: 'var(--text3)',
  },
};
