// FT layer definitions — color used for map layers AND card stripe
export const FT_OPTIONS = ['FT1', 'FT2', 'FT3', 'FT4', 'FT5'];

export const FT_COLORS = {
  FT1: '#22c55e',   // green
  FT2: '#3b82f6',   // blue
  FT3: '#f97316',   // orange
  FT4: '#a855f7',   // purple
  FT5: '#ef4444',   // red
};

export function ftColor(ft) {
  return FT_COLORS[ft] || '#6b7280';
}