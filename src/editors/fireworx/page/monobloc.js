// Extracted from the frozen FireworX prototype. All browser effects belong to this factory.

export function create_monobloc(environment,dependencies={}){
const {URL,document,window,localStorage,navigator,location,matchMedia,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,ResizeObserver,fetch}=environment;

// Move existing surfaces between views; never clone live controls or allocate another patch.
 function createMonobloc({onLayout}){
 const routing=document.getElementById('routing'),rack=document.querySelector('.rack-wrap');
 const routingHome=document.createComment('routing home'),rackHome=document.createComment('rack home');
 routing.before(routingHome);rack.before(rackHome);
 const shell=document.getElementById('monobloc');
 let active=false;
 return {
  get active(){return active;},
  setActive(next){
   active=next;document.body.classList.toggle('monobloc-mode',active);
   if(active){shell.querySelector('.mono-rack').append(rack);shell.querySelector('.mono-workspace').append(routing);routing.classList.remove('hidden');}
   else{rackHome.after(rack);routingHome.after(routing);}
   onLayout();
  }
 };
}

return {createMonobloc};
}
