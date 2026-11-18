import type { ThemePreference } from '../types';

export const THEME_KEY = 'ojaflow:theme';
export const THEME_USER_SET_KEY = 'ojaflow:theme_user_set';
export const THEME_MIGRATED_KEY = 'ojaflow:theme_v2_migrated';

export type ResolvedTheme = 'light' | 'dark';

export function isValidThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

/**
 * Reads the persisted theme preference from localStorage.
 *
 * Rules:
 * 1. Default is always 'light' when no preference is stored or value is invalid.
 * 2. One-time migration: earlier versions of OjaFlow initialized state with
 *    `'system'` and immediately wrote `'ojaflow:theme' = 'system'` to localStorage
 *    on mount without user interaction, forcing OS dark mode on startup.
 *    If `'system'` is found without an explicit user selection marker prior to
 *    migration, it is reset to `'light'`.
 * 3. Any explicit user choice ('light', 'dark', or 'system') is preserved across
 *    page reloads and browser restarts.
 */
export function getInitialThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light';
  }

  try {
    const raw = localStorage.getItem(THEME_KEY);
    const userSet = localStorage.getItem(THEME_USER_SET_KEY) === '1';
    const migrated = localStorage.getItem(THEME_MIGRATED_KEY) === '1';

    if (!migrated) {
      localStorage.setItem(THEME_MIGRATED_KEY, '1');

      if (raw === 'system' && !userSet) {
        localStorage.setItem(THEME_KEY, 'light');
        return 'light';
      }

      if (raw === 'light' || raw === 'dark') {
        localStorage.setItem(THEME_USER_SET_KEY, '1');
        return raw;
      }
    }

    if (isValidThemePreference(raw)) {
      if (raw === 'system' && !userSet) {
        localStorage.setItem(THEME_KEY, 'light');
        return 'light';
      }
      return raw;
    }

    if (raw !== null) {
      localStorage.setItem(THEME_KEY, 'light');
    }
  } catch {
    // Ignore storage access errors and fall back to Light Mode
  }

  return 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'light';
}

export function applyResolvedThemeToDocument(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = resolved;
  }
  return resolved;
}

export function saveThemePreference(preference: ThemePreference): ResolvedTheme {
  const validPreference: ThemePreference = isValidThemePreference(preference)
    ? preference
    : 'light';

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(THEME_KEY, validPreference);
      localStorage.setItem(THEME_USER_SET_KEY, '1');
      localStorage.setItem(THEME_MIGRATED_KEY, '1');
    } catch {
      // Ignore storage quota/access errors
    }
  }

  return applyResolvedThemeToDocument(validPreference);
}
