import type {MidiMonitor,MonitorRow} from '../midi-monitor'

/** Borrowed read/presentation facade. The owner retains capture, bounds and disposal. */
export type MonitorSource=Pick<MidiMonitor,'subscribe'|'version'|'rows'|'realtimeCount'|'paused'|'setPaused'|'clear'>
export interface EditorMonitorTool {
  source:MonitorSource
  describe?:(row:MonitorRow)=>string|null
  assignment?:{canApply:(row:MonitorRow)=>boolean;apply:(row:MonitorRow)=>void}
}
const kinds=new Set(['CC','NRPN','RPN','Note','PB','AT','PC'])
export function canApplyMonitorRow(tool:EditorMonitorTool,row:MonitorRow|null):boolean {
  return !!row&&!row.error&&row.channel!==null&&kinds.has(row.kind)&&
    tool.source.rows().includes(row)&&!!tool.assignment?.canApply(row)
}
/** Recheck against the current store/selection/lock, never a stale enabled button. */
export function applyMonitorRow(tool:EditorMonitorTool,row:MonitorRow|null):boolean {
  if(!canApplyMonitorRow(tool,row))return false
  tool.assignment!.apply(row!)
  return true
}
