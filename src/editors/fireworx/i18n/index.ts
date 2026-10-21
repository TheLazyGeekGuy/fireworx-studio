import type {LanguageLoaders} from '../../../editor-host/page-languages'
/** One module per language, loaded only when the host switches to it. */
export const languageLoaders:LanguageLoaders={it:()=>import('./it'),de:()=>import('./de'),ja:()=>import('./ja'),es:()=>import('./es'),ru:()=>import('./ru'),zh:()=>import('./zh')}
