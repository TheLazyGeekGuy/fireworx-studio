export interface ScreenRenderer {width:number;height:number;draw(ctx:CanvasRenderingContext2D):void}
export type FloatingScreen={redraw():void;close():void}
export function validateScreenSize(screen:{width:number;height:number}){
 if(!Number.isInteger(screen.width)||!Number.isInteger(screen.height)||screen.width<1||screen.height<1||screen.width>4096||screen.height>4096||screen.width*screen.height>8_388_608)throw Error('Invalid screen dimensions')
}
export const floatingScreenSupported=()=>typeof document!=='undefined'&&!!(document as Document&{pictureInPictureEnabled?:boolean}).pictureInPictureEnabled&&typeof HTMLCanvasElement!=='undefined'&&'captureStream'in HTMLCanvasElement.prototype&&typeof HTMLVideoElement!=='undefined'&&typeof (HTMLVideoElement.prototype as HTMLVideoElement&{requestPictureInPicture?:unknown}).requestPictureInPicture==='function'&&typeof document.exitPictureInPicture==='function'
/** Purely visual lifecycle. The module owns dimensions/content, never this host's MIDI transport. */
export async function openFloatingScreen(screen:ScreenRenderer,closed:()=>void,signal?:AbortSignal):Promise<FloatingScreen>{
 validateScreenSize(screen)
 if(signal?.aborted)throw Error('Screen opening cancelled')
 if(!floatingScreenSupported())throw Error('Picture-in-picture is not available in this browser')
 const canvas=document.createElement('canvas');canvas.width=screen.width;canvas.height=screen.height
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable')
 screen.draw(ctx)
 const stream=canvas.captureStream(),video=document.createElement('video') as HTMLVideoElement&{requestPictureInPicture():Promise<unknown>}
 video.muted=true;video.playsInline=true;video.srcObject=stream
 Object.assign(video.style,{position:'fixed',width:'1px',height:'1px',opacity:'0',pointerEvents:'none',left:'0',bottom:'0'})
 let open=true,timer:ReturnType<typeof setInterval>|undefined
 const cleanup=()=>{
  if(!open)return;open=false
  if(timer!==undefined)clearInterval(timer)
  signal?.removeEventListener('abort',close);video.removeEventListener('pause',resume);video.removeEventListener('leavepictureinpicture',cleanup)
  stream.getTracks().forEach(track=>track.stop());video.srcObject=null;video.remove();closed()
 }
 const close=()=>{if(document.pictureInPictureElement===video)void document.exitPictureInPicture().catch(()=>{});cleanup()}
 const resume=()=>{if(open)void video.play().catch(cleanup)}
 const redraw=()=>{if(open)try{screen.draw(ctx)}catch(error){close();throw error}}
 video.addEventListener('pause',resume);video.addEventListener('leavepictureinpicture',cleanup);signal?.addEventListener('abort',close,{once:true})
 try{
  document.body.append(video)
  timer=setInterval(()=>{try{redraw()}catch{/* rendering failure already cleaned up */}},1000)
  await video.play()
  if(!open)throw Error('Screen opening cancelled')
  await video.requestPictureInPicture()
  if(!open){close();throw Error('Screen opening cancelled')}
 }catch(error){close();throw error}
 return {redraw,close}
}
