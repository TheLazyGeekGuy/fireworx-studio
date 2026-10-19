// Protocol-neutral storage shared by profiles, history, presets and declarative forms.
// Statements stay ordered: adapters, not the UI, own their semantics.
export interface ParameterState {
  protocol: string
  statements: string[]
  binding?: string
  opaque?: boolean
}
export interface ProfileParameters {
  preset?: ParameterState
  global?: ParameterState
  extraElements?: { selector: string; state: ParameterState }[]
}
export function validParameterState(value: unknown): value is ParameterState {
  if (!value || typeof value !== 'object') return false
  const s = value as ParameterState
  return typeof s.protocol === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(s.protocol) &&
    Array.isArray(s.statements) && s.statements.length <= 256 && s.statements.every(l => typeof l === 'string' && l.length <= 1024 && !/[\r\n\x00]/.test(l)) &&
    (s.binding === undefined || typeof s.binding === 'string' && s.binding.length <= 4096) && (s.opaque === undefined || typeof s.opaque === 'boolean')
}
export function validProfileParameters(value: unknown): value is ProfileParameters {
  if (!value || typeof value !== 'object') return false
  const s = value as ProfileParameters
  return [s.preset, s.global].every(v => v === undefined || validParameterState(v)) &&
    (s.extraElements === undefined || Array.isArray(s.extraElements) && s.extraElements.length <= 128 && s.extraElements.every(e => /^\$(encoder|button|fader) \d+$/.test(e.selector) && validParameterState(e.state)))
}
export const statementValue = (state: ParameterState | undefined, key: string) => state?.statements.filter(l => l.split(/\s+/)[0] === '.' + key).at(-1)?.slice(key.length + 2).trim()
export function setStatement(state: ParameterState | undefined, protocol: string, key: string, value: string | null): ParameterState {
  const lines = [...(state?.statements ?? [])], indices = lines.flatMap((l, i) => l.split(/\s+/)[0] === '.' + key ? [i] : [])
  // Replace the last occurrence in place; preceding side effects remain meaningful.
  if (value === null) return { ...state, protocol, statements: lines.filter(l => l.split(/\s+/)[0] !== '.' + key) }
  const line = '.' + key + (value ? ' ' + value : '')
  if (indices.length) lines[indices.at(-1)!] = line
  else lines.push(line)
  return { ...state, protocol, statements: lines }
}
