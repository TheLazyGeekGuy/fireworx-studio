// No manufacturer-wide CC numbers: every assignment is a confirmed local profile.
export const performanceKinds=['alpha',...Array.from({length:8},(_,i)=>`ext${i+1}`),'bypass'];
export function validatePerformanceProfile(p){
 if(!p||!Number.isInteger(p.channel)||p.channel<1||p.channel>16)throw Error('Canal CTRL invalide');
 const numbers=[];
 for(const kind of performanceKinds){const n=p[kind]??null;if(n!==null&&(!Number.isInteger(n)||n<0||n>119))throw Error('Affectation CC hors domaine');if(n!==null)numbers.push(n);}
 if(new Set(numbers).size!==numbers.length)throw Error('Un même CC est affecté à plusieurs contrôleurs ; corrigez le profil');
 if(![p.on,p.off].every(n=>Number.isInteger(n)&&n>=0&&n<=127)||p.on===p.off)throw Error('Valeurs Bypass active / inactive invalides');
 return p;
}
export function decodePerformanceCC(bytes,p){
 validatePerformanceProfile(p);
 if(!p.confirmed||bytes.length!==3||bytes[0]!==175+p.channel||bytes[1]>119||bytes[2]>127)return null;
 const kind=performanceKinds.find(kind=>p[kind]!==null&&p[kind]!==undefined&&p[kind]===bytes[1]);return kind?{kind,value:bytes[2]}:null;
}
export function controllerGesture(bytes){
 if(!bytes||bytes.length!==3||!Array.from(bytes).every(Number.isInteger)||bytes[0]<176||bytes[0]>191||bytes[1]<0||bytes[1]>119||bytes[2]<0||bytes[2]>127)return null;
 return {channel:bytes[0]-175,cc:bytes[1],value:bytes[2]};
}
export function learnControllerCC(bytes,{kind,channel=1,assignments={},channels={}}){
 if(!performanceKinds.includes(kind))throw Error('Contrôleur de destination inconnu');
 const gesture=controllerGesture(bytes);if(!gesture)return null;
 const conflict=performanceKinds.find(k=>k!==kind&&assignments[k]===gesture.cc&&(channels[k]??channel)===gesture.channel);
 return conflict?{status:'collision',conflict}:{status:'learned',kind,...gesture};
}
export function decodeControllerAssignment(bytes,{channel,assignments,channels={}}){
 const gesture=controllerGesture(bytes);if(!Number.isInteger(channel)||channel<1||channel>16||!gesture)return null;
 const matches=performanceKinds.filter(kind=>assignments[kind]===gesture.cc&&(channels[kind]??channel)===gesture.channel);
 return matches.length===1?{kind:matches[0],value:gesture.value}:null;
}
export function controllerCC(bytes,p,mapping){
 const r=decodeControllerAssignment(bytes,mapping);if(!r)return null;
 validatePerformanceProfile(p);return p.confirmed&&p[r.kind]!=null?r:null;
}
