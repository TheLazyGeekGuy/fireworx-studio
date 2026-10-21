import {Icon} from '../Icon'
import {translate,useLanguage} from '../i18n'

/** Beside the host's connection status: opens the editor's own MIDI settings, when its view offers them. */
export function MidiSettingsButton({open}:{open?:()=>void}){
  const language=useLanguage()
  if(!open)return null
  const label=translate('MIDI settings',language)
  return <button type="button" className="ew-icon midi-settings-button" title={label} aria-label={label} onClick={open}><Icon name="midi" /></button>
}
