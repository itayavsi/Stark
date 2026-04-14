import type { CSSProperties } from 'react';

import { FT_OPTIONS } from '../services/ftConfig';
import type { FtOption, MatziahOption, QuestPriority, QuestStatus } from '../types/domain';
import {
  EXTERNAL_QUEST_PRIORITY_OPTIONS,
  MATZIAH_OPTIONS,
  getMatziahSelectValue,
  isNezahMatziah,
  isDeadlinePriorityValue,
  QUEST_PRIORITY_OPTIONS,
  getMatziahHint,
} from '../utils/questOptions';

export interface QuestFormValue {
  title: string;
  year: number;
  ft: FtOption | string;
  status: QuestStatus | string;
  priority: QuestPriority | string;
  matziah: MatziahOption | string;
  target_type?: string;
  country?: string;
  zarhan_notes?: string;
  quest_opener?: string;
  objects?: string;
  date?: string;
  deadline_at?: string;
  assigned_user?: string;
  group?: string;
}

interface QuestFormFieldsProps {
  value: QuestFormValue;
  onChange: (nextValue: QuestFormValue) => void;
  allowEmptyPriority?: boolean;
  allowEmptyFt?: boolean;
  showDate?: boolean;
  showAssignedUser?: boolean;
  showGroup?: boolean;
  showZiyuhFields?: boolean;
}

const YEAR_OPTIONS = [2027, 2026, 2025, 2024, 2023];

export default function QuestFormFields({
  value,
  onChange,
  allowEmptyPriority = false,
  allowEmptyFt = false,
  showDate = false,
  showAssignedUser = false,
  showGroup = false,
  showZiyuhFields = false,
}: QuestFormFieldsProps) {
  const matziahSelectValue = getMatziahSelectValue(value.matziah);
  const showNezahFields = showZiyuhFields && isNezahMatziah(value.matziah);

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
        placeholder={showZiyuhFields ? 'שם מטרה *' : 'כותרת משימה *'}
        value={value.title}
        onChange={(event) => updateField('title', event.target.value)}
        required
        style={S.input}
      />
      {showZiyuhFields && (
        <>
          <div style={S.grid2}>
            <input
              className="input"
              placeholder="כינוי/אופי מטרה"
              value={value.target_type || ''}
              onChange={(event) => updateField('target_type', event.target.value)}
              style={S.input}
            />
            <input
              className="input"
              placeholder="זירה"
              value={value.country || ''}
              onChange={(event) => updateField('country', event.target.value)}
              style={S.input}
            />
          </div>
          <input
            className="input"
            placeholder="פותח ציוח"
            value={value.quest_opener || ''}
            onChange={(event) => updateField('quest_opener', event.target.value)}
            style={S.input}
          />
          {showNezahFields && (
            <input
              className="input"
              placeholder="רכיבים"
              value={value.objects || ''}
              onChange={(event) => updateField('objects', event.target.value)}
              style={S.input}
            />
          )}
          <textarea
            className="input"
            placeholder="הערות מהצרכן"
            value={value.zarhan_notes || ''}
            onChange={(event) => updateField('zarhan_notes', event.target.value)}
            rows={2}
            dir="rtl"
            style={{ ...S.input, ...S.zarhanNotesInput }}
          />
        </>
      )}

      {(showDate || showAssignedUser || showGroup) && (
        <div style={S.grid3}>
          {showDate && (
            <div>
              {showNezahFields && <div style={S.inlineLabel}>עדכניות</div>}
              <input
                className="input"
                type="date"
                value={value.date || ''}
                onChange={(event) => updateField('date', event.target.value)}
                style={S.input}
              />
            </div>
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

      <div style={S.grid2}>
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
          value={value.ft || ''}
          onChange={(event) => updateField('ft', event.target.value as FtOption)}
          style={S.input}
        >
          {allowEmptyFt && (
            <option value="">
              ללא צוות ל
            </option>
          )}
          {FT_OPTIONS.map((ft) => (
            <option key={ft} value={ft}>
              {ft}
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
          value={matziahSelectValue}
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
  inlineLabel: {
    fontSize: 10,
    color: 'var(--text3)',
    marginBottom: 4,
    fontWeight: 700,
  },
  zarhanNotesInput: {
    resize: 'both',
    minHeight: 120,
    width: '100%',
    direction: 'rtl',
    textAlign: 'right',
  },
};
