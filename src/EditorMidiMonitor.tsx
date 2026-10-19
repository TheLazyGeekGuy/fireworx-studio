import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { allMessages, formatTime, hex, rowsAsText, visibleRows, type MonitorFilter, type MonitorRow } from './midi-monitor'
import { translate, useLanguage } from './i18n'
import {applyMonitorRow,canApplyMonitorRow,type EditorMonitorTool} from './editor-host/monitor-tools'

// MIDI monitor table: incoming and outgoing messages, filters, NRPN/RPN grouped (expand a row to see its CC messages),
// the control each message belongs to in the current profile, and "Apply to selection" to assign a message to the
// selected controls. Rendered from the store at its notification rate (src/midi-monitor.ts).
const chips: [keyof MonitorFilter, string][] = [['in', '↓ In'], ['out', '↑ Out'], ['CC', 'CC'], ['NRPN', 'NRPN/RPN'], ['Note', 'Notes'], ['Other', 'PC · PB · AT'], ['SysEx', 'SysEx'], ['errorsOnly', 'Errors only']]
const noControl=()=>null
export const EditorMidiMonitor=memo(function EditorMidiMonitor({source:monitor,describe:control=noControl,assignment}:EditorMonitorTool) {
  const tool={source:monitor,describe:control,assignment}
  const language = useLanguage(), t = (text: string) => translate(text, language)
  useSyncExternalStore(monitor.subscribe, monitor.version, monitor.version)
  const [filter, setFilter] = useState<MonitorFilter>(allMessages)
  const [selected, setSelected] = useState<number | null>(null)
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const [copied, setCopied] = useState(false)
  const copyTimer=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(copyTimer.current!==null)clearTimeout(copyTimer.current)}},[])
  const rows = visibleRows(monitor.rows(), filter), shown = rows.slice(-300).reverse()
  const row = monitor.rows().find(r => r.id === selected) ?? null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rowsAsText(rows, control));if(!alive.current)return
      setCopied(true);if(copyTimer.current!==null)clearTimeout(copyTimer.current)
      copyTimer.current=setTimeout(()=>{copyTimer.current=null;setCopied(false)},1500)
    } catch { if(alive.current)setCopied(false) }
  }
  return <section className="midi-monitor" aria-label={t('MIDI monitor')}>
    <div className="monitor-bar">
      <h2>{t('MIDI monitor')}</h2>
      <div className="monitor-chips" role="group" aria-label={t('Message filter')}>{chips.map(([key, label]) =>
        <button key={key} aria-pressed={filter[key]} onClick={() => setFilter(f => ({ ...f, [key]: !f[key] }))}>{t(label)}</button>)}</div>
      <div className="monitor-actions">
        <button onClick={() => monitor.setPaused(!monitor.paused())} aria-pressed={monitor.paused()}>{t(monitor.paused() ? 'Resume' : 'Pause')}</button>
        <button onClick={() => { monitor.clear(); setSelected(null) }}>{t('Clear')}</button>
        <button onClick={() => void copy()} disabled={!rows.length}>{t(copied ? 'Copied' : 'Copy')}</button>
        <button className="primary" disabled={!canApplyMonitorRow(tool,row)} onClick={() => applyMonitorRow(tool,row)} title={t('Assign the selected message to the selected controls')}>{t('Apply to selection')}</button>
      </div>
    </div>
    <p className="monitor-count">{`${rows.length} / ${monitor.rows().length} · ${t('clock and active sensing not listed')}: ${monitor.realtimeCount()}`}</p>
    <div className="monitor-table">{shown.length ? <table>
      <thead><tr><th>{t('Time')}</th><th>{t('Direction')}</th><th>{t('Channel')}</th><th>{t('Type')}</th><th>{t('Parameter')}</th><th>{t('Value')}</th><th>{t('Control')}</th><th>{t('Bytes')}</th></tr></thead>
      <tbody>{shown.flatMap(r => {
        const main = <tr key={r.id} className={`${r.error ? 'error' : ''}`} aria-selected={selected === r.id} onClick={() => setSelected(r.id)}>
          <td>{formatTime(r.time)}</td><td className={`dir-${r.direction}`}>{r.direction === 'in' ? '↓ IN' : '↑ OUT'}</td><td>{r.channel ?? ''}</td>
          <td>{r.kind}{r.parts && <button className="monitor-expand" aria-expanded={!!open[r.id]} onClick={e => { e.stopPropagation(); setOpen(o => Object.fromEntries(monitor.rows().filter(row=>row.id===r.id?!o[r.id]:o[row.id]).map(row=>[row.id,true]))) }}>{`${r.parts.length} CC`}</button>}</td>
          <td>{r.parameter ?? ''}</td><td>{r.value ?? ''}</td><td>{r.error ? t(r.error) : control(r) ?? (r.note ? t(r.note) : '')}</td><td className="monitor-hex">{hex(r.bytes)}</td></tr>
        return r.parts && open[r.id] ? [main, ...r.parts.map((p, i) => <tr key={`${r.id}-${i}`} className="sub"><td /><td /><td>{r.channel}</td><td>CC</td><td>{p[1]}</td><td>{p[2]}</td><td /><td className="monitor-hex">{hex(p)}</td></tr>)] : [main]
      })}</tbody></table> : <p className="monitor-empty">{t('Nothing received or sent yet. Turn a knob or press a key on the controller.')}</p>}</div>
  </section>
})
