export type IconName = 'folder' | 'save' | 'copy' | 'import' | 'export' | 'print' | 'palette' | 'sliders' | 'midi' | 'log' | 'expand' | 'collapse' | 'send' | 'power' | 'rotate' | 'push' | 'close' | 'language' | 'gear' | 'help'
const paths: Record<IconName, string[]> = {
  gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z','M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z'],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z','M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3','M12 17h.01'],
  folder: ['M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z'],
  save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z','M7 3v6h10V3','M7 21v-8h10v8'],
  copy: ['M9 9h11v11H9Z','M15 9V4H4v11h5'],
  import: ['M12 3v12','m7 10 5 5 5-5','M4 16v5h16v-5'],
  export: ['M12 16V3','m7 8 5-5 5 5','M4 16v5h16v-5'],
  print: ['M6 8V3h12v5','M6 17H3V9h18v8h-3','M6 14h12v7H6Z','M17 11h1'],
  palette: ['M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-8Z','M7 9h.01M10 6h.01M15 6h.01M18 9h.01'],
  sliders: ['M4 3v18M12 3v18M20 3v18','M1 8h6M9 16h6M17 7h6'],
  midi: ['M8 3v5M16 3v5','M5 8h14v3a7 7 0 0 1-7 7 7 7 0 0 1-7-7V8Z','M12 18v3'],
  log: ['M7 3h10v3h3v15H4V6h3V3Z','M8 11h8M8 15h8M8 18h5'],
  expand: ['M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5'],
  collapse: ['M3 8h5V3M21 8h-5V3M16 21v-5h5M8 21v-5H3'],
  send: ['M22 2 9 15','m22 2-8 20-5-7-7-5 20-8Z'],
  power: ['M12 2v10','M6 5a9 9 0 1 0 12 0'],
  rotate: ['M21 9a9 9 0 1 0-2 10','M21 3v6h-6'],
  push: ['M12 3v10','m8 9 4 4 4-4','M4 16h16v5H4Z'],
  close: ['m6 6 12 12M18 6 6 18'],
  language: ['M3 5h12M9 3v2M13 5c-1 6-4 9-9 11M5 8c1 3 4 6 7 8', 'm14 21 4-10 4 10M15.5 17h5'],
}
export function Icon({ name }: { name: IconName }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name].map((d,i)=><path key={i} d={d} />)}</svg>
}
