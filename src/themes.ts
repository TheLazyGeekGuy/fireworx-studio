export const themes = [
  { id: 'original', name: 'Original' },
  { id: 'graphite', name: 'Graphite' },
  { id: 'glacier', name: 'Glacier' },
  { id: 'amethyst', name: 'Amethyst' },
  { id: 'brass', name: 'Brass' },
  { id: 'silver', name: 'Silver' },
  { id: 'midnight', name: 'Midnight' },
] as const
export type Theme = typeof themes[number]['id']
export const themeStorageKey = 'bcr32-studio.theme.v1'
export const parseTheme = (value: unknown): Theme => themes.some(t => t.id === value) ? value as Theme : 'original'
export function loadTheme(): Theme {
  try { return parseTheme(window.localStorage.getItem(themeStorageKey)) } catch { return 'original' }
}
