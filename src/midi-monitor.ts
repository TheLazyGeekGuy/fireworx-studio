// MIDI monitor: every message received from or sent to the controller, classified and grouped for reading. Pure
// store (no React, no MIDI): push() takes the bytes as they pass, subscribers are told at most once per `notifyMs`, so a
// fast knob costs one table render per tick, not one per message. Clock and active sensing are counted, not listed.
export type MonitorDirection = 'in' | 'out'
export type MonitorKind = 'CC' | 'NRPN' | 'RPN' | 'Note' | 'PC' | 'PB' | 'AT' | 'SysEx' | 'System'
export type MonitorRow = {
  id: number; time: number; direction: MonitorDirection; kind: MonitorKind
  channel: number | null; parameter: number | null; value: number | null
  bytes: number[] // the message, or for a grouped NRPN/RPN all its CC messages one after the other
  parts?: number[][] // grouped NRPN/RPN: the CC messages
  error?: string // a reply reporting an error, or a malformed message
  note?: string // what sent it (e.g. "value sent", "read request")
}
export type MonitorFilter = { in: boolean; out: boolean; CC: boolean; NRPN: boolean; Note: boolean; Other: boolean; SysEx: boolean; errorsOnly: boolean }
export const allMessages: MonitorFilter = { in: true, out: true, CC: true, NRPN: true, Note: true, Other: true, SysEx: true, errorsOnly: false }
export const isRealtime = (bytes: ArrayLike<number>) => bytes.length === 1 && bytes[0] >= 0xf8

export function classify(bytes: ArrayLike<number>): Pick<MonitorRow, 'kind' | 'channel' | 'parameter' | 'value' | 'error'> {
  const b = Array.from(bytes), status = b[0] ?? 0, type = status & 0xf0, channel = (status & 0x0f) + 1
  const need = (n: number) => b.length < n || b.slice(1, n).some(x => x > 0x7f) ? 'Incomplete or invalid message' : undefined
  switch (type) {
    case 0x80: case 0x90: return { kind: 'Note', channel, parameter: b[1] ?? null, value: type === 0x80 ? 0 : b[2] ?? null, error: need(3) }
    case 0xa0: return { kind: 'AT', channel, parameter: b[1] ?? null, value: b[2] ?? null, error: need(3) }
    case 0xb0: return { kind: 'CC', channel, parameter: b[1] ?? null, value: b[2] ?? null, error: need(3) }
    case 0xc0: return { kind: 'PC', channel, parameter: null, value: b[1] ?? null, error: need(2) }
    case 0xd0: return { kind: 'AT', channel, parameter: null, value: b[1] ?? null, error: need(2) }
    case 0xe0: return { kind: 'PB', channel, parameter: null, value: (b[2] ?? 0) << 7 | (b[1] ?? 0), error: need(3) }
  }
  if (status === 0xf0) {
    // B-Control BCL reply (command 21, index, error code): a non-zero code is an error the user must see.
    const bcl = b.length === 11 && b[1] === 0x00 && b[2] === 0x20 && b[3] === 0x32 && b[6] === 0x21 && b[9] !== 0
    return { kind: 'SysEx', channel: null, parameter: null, value: null, error: b.at(-1) !== 0xf7 ? 'SysEx without end byte (F7)' : bcl ? `BCL error ${b[9]} at line ${(b[7] << 7 | b[8]) + 1}` : undefined }
  }
  return { kind: 'System', channel: null, parameter: null, value: null }
}

export function createMonitor({ limit = 500, notifyMs = 100, clock = () => performance.now(), timers = { set: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown, clear: (t: unknown) => clearTimeout(t as ReturnType<typeof setTimeout>) } } = {}) {
  let rows: MonitorRow[] = [], nextId = 1, realtime = 0, paused = false, version = 0
  const start = clock(), listeners = new Set<() => void>()
  let timer: unknown = null
  // NRPN/RPN in progress per direction and channel: the selected parameter and the data MSB, and the row being built.
  const selection = new Map<string, { kind: 'NRPN' | 'RPN'; msb: number | null; lsb: number | null; dataMsb: number | null; row: MonitorRow | null }>()
  const notify = () => { version++; if (timer === null) timer = timers.set(() => { timer = null; listeners.forEach(fn => fn()) }, notifyMs) }
  const add = (row: Omit<MonitorRow, 'id'>) => { const r = { ...row, id: nextId++ }; rows.push(r); if (rows.length > limit) rows = rows.slice(rows.length - limit); return r }
  function push(direction: MonitorDirection, message: ArrayLike<number>, note?: string) {
    const bytes = Array.from(message)
    if (!bytes.length) return
    if (isRealtime(bytes)) { realtime++; return }
    if (paused) return
    const time = clock() - start, c = classify(bytes)
    if (c.kind === 'CC' && !c.error) {
      const key = `${direction}:${c.channel}`, cc = c.parameter!, v = c.value!
      let s = selection.get(key)
      // 99/98: NRPN select, 101/100: RPN select; 6/38: data MSB/LSB, 96/97: increment/decrement.
      if (cc === 99 || cc === 98 || cc === 101 || cc === 100) {
        const kind = cc >= 100 ? 'RPN' : 'NRPN'
        if (!s || s.kind !== kind || !s.row || s.row.parts!.length >= 4 || (cc === 99 || cc === 101)) s = { kind, msb: null, lsb: null, dataMsb: null, row: null }
        if (cc === 99 || cc === 101) s.msb = v; else s.lsb = v
        if (!s.row) s.row = add({ time, direction, kind, channel: c.channel, parameter: null, value: null, bytes: [], parts: [], note })
        s.row.parts!.push(bytes); s.row.bytes = s.row.parts!.flat(); s.row.time = time
        s.row.parameter = s.msb !== null && s.lsb !== null ? s.msb << 7 | s.lsb : null
        selection.set(key, s); notify(); return
      }
      if (s && s.msb !== null && s.lsb !== null && (cc === 6 || cc === 38 || cc === 96 || cc === 97)) {
        // Data for the selected parameter: into the row being built, or a new row for the same parameter.
        let row = s.row && s.row.parts!.length < 4 && !(cc === 6 && s.row.value !== null) ? s.row : null
        if (!row) row = s.row = add({ time, direction, kind: s.kind, channel: c.channel, parameter: s.msb << 7 | s.lsb, value: null, bytes: [], parts: [], note })
        row.parts!.push(bytes); row.bytes = row.parts!.flat(); row.time = time
        if (cc === 6) { s.dataMsb = v; row.value = v } // 7-bit data until an LSB (CC 38) makes it 14-bit
        else if (cc === 38) row.value = (s.dataMsb ?? 0) << 7 | v
        else row.value = cc === 96 ? +1 : -1
        notify(); return
      }
    }
    add({ time, direction, ...c, bytes, note }); notify()
  }
  return {
    push,
    rows: () => rows, version: () => version, realtimeCount: () => realtime, startedAt: start,
    clear() { rows = []; selection.clear(); realtime = 0; notify() },
    setPaused(p: boolean) { paused = p; notify() }, paused: () => paused,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    dispose() { if (timer !== null) timers.clear(timer); timer = null; listeners.clear(); selection.clear() },
  }
}
export type MidiMonitor = ReturnType<typeof createMonitor>

const groupOf = (kind: MonitorKind): keyof MonitorFilter => kind === 'CC' ? 'CC' : kind === 'NRPN' || kind === 'RPN' ? 'NRPN' : kind === 'Note' ? 'Note' : kind === 'SysEx' ? 'SysEx' : 'Other'
export const visibleRows = (rows: MonitorRow[], f: MonitorFilter) => rows.filter(r => f[r.direction] && (f.errorsOnly ? !!r.error : f[groupOf(r.kind)]))
export const hex = (bytes: number[]) => bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
export const formatTime = (ms: number) => { const s = ms / 1000; return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(3).padStart(6, '0')}` }
// Tab-separated text of the rows, for the clipboard.
export const rowsAsText = (rows: MonitorRow[], control: (r: MonitorRow) => string | null = () => null) =>
  ['time\tdirection\tchannel\ttype\tparameter\tvalue\tcontrol\tbytes', ...rows.map(r => [formatTime(r.time), r.direction, r.channel ?? '', r.kind, r.parameter ?? '', r.value ?? '', control(r) ?? '', hex(r.bytes)].join('\t'))].join('\n')
