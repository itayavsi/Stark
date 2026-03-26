import type { CSSProperties } from 'react';

import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { mode, toggleMode } = useTheme();
  const isDark = mode === 'dark';

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={toggleMode}
      title={isDark ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
      style={compact ? S.compact : undefined}
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
      <span>{isDark ? 'מצב בהיר' : 'מצב כהה'}</span>
    </button>
  );
}

const S: Record<string, CSSProperties> = {
  compact: {
    minWidth: 110,
    justifyContent: 'center',
  },
};
