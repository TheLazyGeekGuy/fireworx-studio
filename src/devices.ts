import { bcr32 } from './device-bcr32'
import { bcr2000 } from './device-bcr2000'
import { bcf2000 } from './device-bcf2000'
import type { DeviceDefinition } from './device-definition'

// Known controller models and the one the editor works with. The choice is kept per browser; changing it reloads the
// editor, so every module reads one model for the life of the page.
export const devices: Record<string, DeviceDefinition> = { bcr32, bcr2000, bcf2000 }
export const deviceChoiceKey = 'bcr-studio.device'
function storedChoice(): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(deviceChoiceKey) } catch { return null }
}
export const currentDevice: DeviceDefinition = devices[storedChoice() ?? ''] ?? bcr32

// Storage of profiles, drafts and presets is per model; the BCR32 keeps its historical keys.
export const scopedKey = (key: string) => currentDevice.id === 'bcr32' ? key : key.replace(/^bcr32-studio\./, `bcr-studio.${currentDevice.id}.`)

export function chooseDevice(id: string) {
  if (!devices[id] || id === currentDevice.id) return
  try { window.localStorage.setItem(deviceChoiceKey, id) } catch { return }
  window.location.reload()
}
