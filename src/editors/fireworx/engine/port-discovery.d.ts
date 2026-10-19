export interface NamedPort { readonly name?: string | null; readonly state?: string }
export function isFireworxPortName(name: unknown): boolean;
export function fireworxPortPair<I extends NamedPort,O extends NamedPort>(access:{inputs:ReadonlyMap<string,I>;outputs:ReadonlyMap<string,O>}):{input:I|null;output:O|null;ambiguous:boolean;ready:boolean};
