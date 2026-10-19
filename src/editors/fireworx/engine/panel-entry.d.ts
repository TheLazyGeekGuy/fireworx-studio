export interface PanelEntryOptions {anchor:Element;label:string;value:string|number|null;type?:string;min?:number;max?:number;maxLength?:number;commit(value:string|number):void}
export function createPanelEntry(container:HTMLElement):{close():void;open(options:PanelEntryOptions):void};
