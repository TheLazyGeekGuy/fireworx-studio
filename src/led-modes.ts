export const ledModes = ['off', '1dot_in', '1dot_ex', '2dot_in', '2dot_ex', 'bar', 'bar_ex', 'spread', 'pan', 'qual', 'cut', 'damp'] as const
export type LedMode = typeof ledModes[number] | 'dot' // Legacy preset alias.
export const ledModeLabel: Record<LedMode, string> = { off: 'OFF', '1dot_in': '1dot_in', '1dot_ex': '1dot_ex', '2dot_in': '2dot_in', '2dot_ex': '2dot_ex', bar: 'Bar', bar_ex: 'Bar−', spread: 'SPRD', pan: 'Pan', qual: 'Qual', cut: 'Cut', damp: 'Damp', dot: '1dot_in' }
export const validLedMode = (value: unknown): value is LedMode => value === 'dot' || ledModes.some(mode => mode === value)
export function ledSegments(mode: LedMode, value: number, minimum = 0, maximum = 127, enabled = true, known = true): boolean[] {
  const empty = () => Array<boolean>(21).fill(false)
  if (!enabled || !known || mode === 'off' || !Number.isFinite(value)) return empty()
  const t = maximum === minimum ? 0 : Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)))
  const index = Math.round(t * 20)
  // '_ex' excludes the lower endpoint, equivalent to 0 on the default range.
  if (['1dot_ex', '2dot_ex', 'bar_ex'].includes(mode) && t === 0) return empty()
  const halfStep = Math.round(t * 40), left = Math.floor(halfStep / 2), right = Math.ceil(halfStep / 2)
  return Array.from({ length: 21 }, (_, i) => {
    switch (mode) {
      case 'dot': case '1dot_in': case '1dot_ex': return i === index
      case '2dot_in': case '2dot_ex': return i === left || i === right
      case 'bar': case 'bar_ex': return i <= index
      case 'spread': return Math.abs(i - 10) <= Math.round(t * 10)
      case 'qual': return Math.abs(i - 10) <= Math.round((1 - t) * 10)
      case 'pan': return i >= Math.min(10, index) && i <= Math.max(10, index)
      case 'cut': return t < 1 && i >= Math.floor(t * 21)
      case 'damp': return i >= 20 - index
      default: return false
    }
  })
}
