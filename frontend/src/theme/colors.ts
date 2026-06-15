export const lightColors = {
  background: '#FAF9F6',
  surface: '#FFFFFF',
  surface2: '#F0EEE9',
  border: '#E8E5DE',
  accent: '#FF5722',
  accentLight: '#FF7043',
  textPrimary: '#1A1917',
  textSecondary: '#4D4B47',
  textMuted: '#9A9690',
  success: '#2E7D32',
  warning: '#F57C00',
  error: '#C62828',
  authHigh: '#2E7D32',
  authMedium: '#F57C00',
  authLow: '#C62828',
};

export const darkColors = {
  background: '#0F0F0F',
  surface: '#1C1C1E',
  surface2: '#2C2C2E',
  border: '#38383A',
  accent: '#FF5722',
  accentLight: '#FF7043',
  textPrimary: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMuted: '#636366',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#FF453A',
  authHigh: '#4CAF50',
  authMedium: '#FFC107',
  authLow: '#FF5722',
};

export type Colors = typeof lightColors;

// Default export kept for backward compatibility during transition
export const colors = lightColors;
