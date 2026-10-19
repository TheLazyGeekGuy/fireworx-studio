import type {Appearance} from '../../editor-host/contracts'
import {freezeLocalAppearance,type LocalAppearance} from '../../editor-host/local-appearance'
import {localAppearance as descriptor} from './engine/appearance-presets.js'
export const localAppearance=freezeLocalAppearance(descriptor as LocalAppearance)
const palettes:Record<string,string[]>={
 original:['#101113','#191c20','#f0eee8','#b9b3aa','#e2a34c','#484540'],
 graphite:['#101214','#191c20','#f0eee8','#adb7bf','#c0cbd4','#414b54'],
 glacier:['#091319','#10212a','#e4f2f5','#a6c2ce','#76d6ed','#355260'],
 amethyst:['#15101c','#241c30','#f0e8fa','#c1afd6','#c5a0ed','#514263'],
 brass:['#19150e','#282117','#f4eee3','#c4b497','#e6bd73','#61523b'],
 midnight:['#101419','#171d24','#e1e7ed','#aab7c7','#ff851b','#303c4d'],
 silver:['#e1e5e8','#f0f2f4','#1a242d','#465766','#245b81','#8999a5'],
}
export function inheritedColors(appearance:Appearance){return Object.fromEntries(['background','surface','text','muted','accent','line'].map((key,i)=>[key,(palettes[appearance.theme]??palettes.original)[i]]))}
