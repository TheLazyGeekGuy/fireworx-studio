// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.

export function create_screen(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;

// Extend the screen by moving the real workspace. No second grid or patch state.
 function createScreen({onMode,onLayout}){
 const dialog=document.getElementById('lcd-enlarged'),surface=document.getElementById('screen-surface'),routing=document.getElementById('routing');
 let home=null,returnFocus=null,mode='routing',wasHidden=false;
 function setMode(next){mode=next;dialog.dataset.mode=mode;document.querySelectorAll('[data-screen-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.screenMode===mode)));onMode(mode);}
 function restore(){if(home){home.after(routing);home.remove();home=null;routing.classList.toggle('hidden',wasHidden);}document.body.classList.remove('screen-open');onLayout();if(returnFocus?.isConnected)returnFocus.focus();}
 dialog.addEventListener('close',restore);
 document.getElementById('lcd-close').onclick=()=>dialog.close();
 document.querySelectorAll('[data-screen-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.screenMode));
 return {get mode(){return mode;},get open(){return dialog.open;},setMode,
  show(next='routing'){
   if(!dialog.open){returnFocus=document.activeElement;wasHidden=routing.classList.contains('hidden');routing.classList.remove('hidden');home=document.createComment('expanded screen home');routing.before(home);surface.append(routing);document.body.classList.add('screen-open');dialog.showModal();}
   setMode(next);onLayout();
  },close(){if(dialog.open){dialog.close();restore();}}
 };
}

return {createScreen};
}
