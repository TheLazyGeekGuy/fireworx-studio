/** Descriptive reuse metadata, never MIDI authorization or persisted device state. */
export interface DeviceFamilyMember<Feature extends string = string> {
  readonly familyId: string
  readonly familyRevision: number
  readonly modelId: string
  readonly features: Readonly<Record<Feature, boolean>>
}

const identifier = /^[a-z][a-z0-9-]{0,63}$/
const forbidden = new Set(['constructor', 'prototype', '__proto__'])
function record(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === 'object' &&
    (Object.getPrototypeOf(raw) === Object.prototype || Object.getPrototypeOf(raw) === null)
}
function features(raw: unknown): Readonly<Record<string, boolean>> {
  if (!record(raw) || Object.keys(raw).length > 128) throw Error('Invalid family features')
  const result: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!identifier.test(key) || forbidden.has(key) || typeof value !== 'boolean') throw Error('Invalid family feature')
    result[key] = value
  }
  return Object.freeze(result)
}

export function validateDeviceFamilyMember(raw: unknown): DeviceFamilyMember {
  if (!record(raw) || Object.keys(raw).length !== 4 ||
    Object.keys(raw).some(k => !['familyId', 'familyRevision', 'modelId', 'features'].includes(k)) ||
    typeof raw.familyId !== 'string' || !identifier.test(raw.familyId) ||
    typeof raw.modelId !== 'string' || !identifier.test(raw.modelId) ||
    !Number.isSafeInteger(raw.familyRevision) || (raw.familyRevision as number) < 1) throw Error('Invalid family member')
  return Object.freeze({familyId: raw.familyId, familyRevision: raw.familyRevision as number,
    modelId: raw.modelId, features: features(raw.features)})
}

/** No registry, model imports, instances or side effects. Construct only the requested leaf. */
export function defineDeviceFamily<Defaults extends Record<string, boolean>>(
  id: string, revision: number, defaults: Defaults,
) {
  const base = validateDeviceFamilyMember({familyId: id, familyRevision: revision, modelId: id, features: defaults})
  type Feature = Extract<keyof Defaults, string>
  return Object.freeze({
    id: base.familyId, revision: base.familyRevision,
    defaults: base.features as Readonly<Record<Feature, boolean>>,
    member(modelId: string, overrides: Partial<Record<Feature, boolean>> = {}): DeviceFamilyMember<Feature> {
      const patch = features(overrides)
      if (Object.keys(patch).some(key => !Object.hasOwn(base.features, key))) throw Error('Unknown family feature override')
      return validateDeviceFamilyMember({...base, modelId, features: {...base.features, ...patch}}) as DeviceFamilyMember<Feature>
    },
  })
}
