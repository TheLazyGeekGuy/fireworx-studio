export interface Distribution {readonly modules:readonly string[];readonly mode:'legacy'|'workspace'|'standalone';readonly library:boolean}
export const profiles:Readonly<Record<string,Distribution>>
export function resolveDistribution(input?:unknown):Distribution
export function distributionSource(input:unknown):string
export function distributionPlugin():import('vite').Plugin
