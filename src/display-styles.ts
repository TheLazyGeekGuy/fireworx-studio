// Screen styles for the OLED and the label screen (Config). Colours live in CSS ([data-display="…"] in styles.css);
// this list gives the ids, the order and the names shown in Config. The first one is the default.
export const displayStyles = [
  { id: 'ice', name: 'Ice OLED' },
  { id: 'amber', name: 'Amber VFD' },
  { id: 'green', name: 'Green LCD' },
  { id: 'red', name: 'Red LED' },
  { id: 'white', name: 'White OLED' },
] as const
export type DisplayStyle = typeof displayStyles[number]['id']
export const displayStyleKey = 'bcr32-studio.display-style'
export const validDisplayStyle = (value: unknown): value is DisplayStyle => displayStyles.some(s => s.id === value)
