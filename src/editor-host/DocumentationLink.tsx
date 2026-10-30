import {createContext,useContext} from 'react'
import {publicAsset} from '../deployment-base'

/** Instance-local manual action; other hosts retain the static documentation portal. */
const DocumentationContext=createContext<(()=>void)|undefined>(undefined)
export const DocumentationProvider=DocumentationContext.Provider
export function DocumentationLink(){
 const open=useContext(DocumentationContext)
 return open?<button className="documentation-link" onClick={open}>Documentation</button>:<a className="documentation-link" href={publicAsset('docs/')} target="_blank" rel="noopener noreferrer">Documentation</a>
}
