// Same inert shape as EditorPresentation.localAppearance. Owned by this module.
// `renders` / `defaults.render` (#75) are an optional extension: flat stays the default.
export const localAppearance={
 themes:[
  {id:'graphite',name:'Graphite / Indigo',scheme:'dark',colors:{background:'#111318',surface:'#1C2029',text:'#EBEEF5',muted:'#ADB6C7',accent:'#A4B1FF',line:'#424959'}},
  {id:'porcelain',name:'Porcelaine / Cobalt',scheme:'light',colors:{background:'#F1F3F7',surface:'#FFFFFF',text:'#192333',muted:'#526176',accent:'#2856CB',line:'#C1C9D7'}},
  {id:'slate',name:'Ardoise / Turquoise',scheme:'dark',colors:{background:'#101D24',surface:'#1B2C35',text:'#E4F2F5',muted:'#A5BEC8',accent:'#55D9C3',line:'#415D69'}},
  {id:'sand',name:'Sable / Terracotta',scheme:'light',colors:{background:'#F0ECE5',surface:'#FBF8F3',text:'#302A27',muted:'#6D5D52',accent:'#AE432C',line:'#CABBAD'}},
  {id:'heritage',name:'Héritage / LCD vert',scheme:'dark',colors:{background:'#121513',surface:'#1B201D',text:'#E6EBE5',muted:'#A7B0A7',accent:'#C5E987',line:'#465047'}}
 ],
 layouts:[
  {id:'studio',name:'Studio',description:'Bibliothèque à gauche, chaîne au-dessus des réglages.'},
  {id:'console',name:'Console',description:'Chaîne et bibliothèque à gauche, inspecteur permanent à droite.'},
  {id:'focus',name:'Focus',description:'Bibliothèque repliable, grande matrice et réglages sur toute la largeur.'}
 ],
 surfaces:['hardware','modern'],renders:['flat','rich'],defaults:{theme:'porcelain',layout:'console',surface:'hardware',render:'flat'}
};
export const renderNames={flat:'Plat',rich:'Relief'};
export const proposals=[
 {theme:'graphite',layout:'studio',title:'01 · Studio nocturne',description:'Indigo sur graphite. La chaîne guide le regard, les réglages suivent.'},
 {theme:'porcelain',layout:'console',title:'02 · Console claire',description:'Cobalt sur porcelaine. Deux espaces côte à côte pour router et régler.'},
 {theme:'slate',layout:'focus',title:'03 · Signal large',description:'Turquoise sur ardoise. Une matrice ample, les outils de création à la demande.'},
 {theme:'sand',layout:'console',title:'04 · Atelier minéral',description:'Terracotta sur sable. Contrastes doux et inspecteur latéral.'}
];
export function contrast(a,b){
 const luminance=hex=>{const channels=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
 const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function validColors(colors){return colors&&Object.keys(localAppearance.themes[0].colors).every(k=>typeof colors[k]==='string'&&/^#[0-9a-f]{6}$/i.test(colors[k]))&&['background','surface'].every(k=>contrast(colors.text,colors[k])>=4.5&&contrast(colors.muted,colors[k])>=4.5&&contrast(colors.accent,colors[k])>=4.5);}
export function normalizeAppearance(value){
 const v=value&&typeof value==='object'?value:{},theme=localAppearance.themes.find(t=>t.id===v.theme)??localAppearance.themes.find(t=>t.id===localAppearance.defaults.theme);
 return {theme:theme.id,layout:localAppearance.layouts.some(l=>l.id===v.layout)?v.layout:localAppearance.defaults.layout,surface:localAppearance.surfaces.includes(v.surface)?v.surface:localAppearance.defaults.surface,render:localAppearance.renders.includes(v.render)?v.render:localAppearance.defaults.render,colors:validColors(v.colors)?Object.fromEntries(Object.keys(theme.colors).map(k=>[k,v.colors[k]])):null};
}

// Rich render (#75): material colors derived from the palette, never hard-coded per theme.
// Every color that can sit under text is checked so text, muted and accent keep 4.5:1,
// including the sRGB interpolation of each gradient pair used by rich-render.css.
export const mixHex=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
export const richGradientPairs=[['raised','surface'],['surface','sunken'],['raised','sunken'],['raised','well'],['well','sunken'],['selected','sunken'],['raised','selected']];
const inks=colors=>[colors.text,colors.muted,colors.accent];
const readableOn=(back,list,min=4.5)=>list.every(ink=>contrast(ink,back)>=min);
const gradientReadable=(a,b,list)=>Array.from({length:11},(_,i)=>mixHex(a,b,i/10)).every(c=>readableOn(c,list));
function safeMix(base,target,amount,list){for(let t=Math.round(amount*100);t>0;t--){const c=mixHex(base,target,t/100);if(readableOn(c,list))return c;}return base;}
export function richMaterial(colors,scheme){
 const dark=scheme==='dark',list=inks(colors),s=colors.surface.toLowerCase(),m={
  surface:s,background:colors.background.toLowerCase(),
  raised:safeMix(s,'#ffffff',dark?.09:.75,list),
  sunken:safeMix(s,'#000000',dark?.3:.05,list),
  well:safeMix(colors.background.toLowerCase(),'#000000',dark?.32:.03,list),
  selected:safeMix(s,colors.accent.toLowerCase(),.16,list)
 };
 // A pair whose interpolation dips under the threshold collapses to the surface (flat).
 for(const [a,b] of richGradientPairs)if(!gradientReadable(m[a],m[b],list)){if(b!=='surface')m[b]=s;if(!gradientReadable(m[a],m[b],list))m[a]=s;}
 // Knob bodies carry no text: their shading is free of the readability rule.
 return {...m,knobHi:mixHex(s,'#ffffff',dark?.16:.9),knobLo:mixHex(s,'#000000',dark?.5:.22),shadow:dark?'rgb(0 0 0 / .55)':'rgb(38 44 58 / .22)',highlight:dark?'rgb(255 255 255 / .1)':'rgb(255 255 255 / .9)',scheme};
}
// Original family hue wheel (no manufacturer colors). Lightness is solved per palette.
// Families that often share a patch (filter / delay / reverb / dynamic / pitch) sit far apart.
export const familyHues={distort:0,dynamic:30,pitch:55,eq:95,pan:125,filter:160,synth:190,delay:215,vocode:245,reverb:275,formant:300,chorus:330};
const hsl=(h,s,l)=>{s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');};
export const richBacks=material=>['background','surface','raised','sunken','well','selected'].map(k=>material[k]);
export function familyAccents(colors,scheme,material=richMaterial(colors,scheme)){
 const dark=scheme==='dark',backs=richBacks(material),ok=c=>backs.every(b=>contrast(c,b)>=4.5)&&richGradientPairs.every(([a,b])=>Array.from({length:11},(_,i)=>mixHex(material[a],material[b],i/10)).every(back=>contrast(c,back)>=4.5));
 return Object.fromEntries(Object.entries(familyHues).map(([id,hue])=>{
  for(let l=dark?66:42;dark?l<=94:l>=8;l+=dark?1:-1){const c=hsl(hue,dark?78:72,l);if(ok(c))return [id,c];}
  return [id,colors.text.toLowerCase()];
 }));
}
