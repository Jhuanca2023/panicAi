export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  danger: string;
  dangerText: string;
  error: string;
  success: string;
  overlay: string;
};

// Paleta de colores (verde oscuro/teal)
export const lightColors: ThemeColors = {
  background:      '#f8fafc',
  surface:         '#ffffff',
  surfaceElevated: '#ffffff',
  text:            '#0f172a',
  textSecondary:   '#475569',
  textMuted:       '#94a3b8',
  border:          '#e2e8f0',
  primary:         '#004b49',
  primaryText:     '#ffffff',
  danger:          '#ef4444',
  dangerText:      '#ffffff',
  error:           '#ef4444',
  success:         '#10b981',
  overlay:         'rgba(0,0,0,0.5)',
};

export const darkColors: ThemeColors = {
  background:      '#0f172a',
  surface:         '#1e293b',
  surfaceElevated: '#334155',
  text:            '#f1f5f9',
  textSecondary:   '#94a3b8',
  textMuted:       '#64748b',
  border:          '#334155',
  primary:         '#2dd4bf',
  primaryText:     '#0f172a',
  danger:          '#f87171',
  dangerText:      '#0f172a',
  error:           '#f87171',
  success:         '#2dd4bf',
  overlay:         'rgba(0,0,0,0.7)',
};
