import {Component,type ReactNode,type ErrorInfo} from 'react'
import type {EditorViewProps,EditorViewRuntime} from './view-contract'
export function EditorViewContent({view,...props}:EditorViewProps&{view:EditorViewRuntime}){return view.render(props)}
export class EditorViewBoundary extends Component<{children:ReactNode;fallback:ReactNode;onFault:(error:unknown)=>void},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(error:Error,_info:ErrorInfo){this.props.onFault(error)}
  render(){return this.state.failed?this.props.fallback:this.props.children}
}
