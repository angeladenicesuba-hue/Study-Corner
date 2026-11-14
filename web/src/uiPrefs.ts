export type ThemeMode = 'light' | 'dark';
export type UiScale = 'compact' | 'normal' | 'large' | 'xlarge';

export interface UiPreferences {
  theme: ThemeMode;
  scale: UiScale;
}

const UI_PREFS_KEY = 'sc_pos_ui_prefs_v1';

export const UI_SCALE_OPTIONS: Array<{
  id: UiScale;
  label: string;
  percent: string;
  rootFontPx: number;
}> = [
  { id: 'compact', label: 'Compact', percent: '90%', rootFontPx: 14.4 },
  { id: 'normal', label: 'Normal', percent: '100%', rootFontPx: 16 },
  { id: 'large', label: 'Large', percent: '112%', rootFontPx: 18 },
  { id: 'xlarge', label: 'Extra Large', percent: '125%', rootFontPx: 20 },
];

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  theme: 'light',
  scale: 'normal',
};

export function loadUiPreferences(): UiPreferences {
  if (typeof window === 'undefined') return DEFAULT_UI_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return DEFAULT_UI_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    const theme: ThemeMode = parsed.theme === 'dark' ? 'dark' : 'light';
    const validScale = UI_SCALE_OPTIONS.some((o) => o.id === parsed.scale)
      ? (parsed.scale as UiScale)
      : 'normal';
    return { theme, scale: validScale };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

export function applyUiPreferences(prefs: UiPreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', prefs.theme === 'dark');
  const option = UI_SCALE_OPTIONS.find((o) => o.id === prefs.scale) || UI_SCALE_OPTIONS[1];
  root.style.fontSize = `${option.rootFontPx}px`;
}

export function saveUiPreferences(prefs: UiPreferences): UiPreferences {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  }
  applyUiPreferences(prefs);
  return prefs;
}
