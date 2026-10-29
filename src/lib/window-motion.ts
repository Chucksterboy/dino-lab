import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface MotionWindow {
 isMinimized():Promise<boolean>;
 isVisible():Promise<boolean>;
 onResized(handler:()=>void):Promise<()=>void>;
 onFocusChanged(handler:()=>void):Promise<()=>void>;
}
export interface WindowMotionEnvironment {
 document:Pick<Document,'hidden'|'addEventListener'|'removeEventListener'>;
 nativeWindow?:MotionWindow;
}

/** Focus changes only prompt a visibility read: visible unfocused windows keep moving. */
export function watchWindowMotion(onPaused:(paused:boolean)=>void,environment?:WindowMotionEnvironment):()=>void {
 const document_=environment?.document??(typeof document==='undefined'?undefined:document);
 if(!document_)return()=>{};
 let nativeWindow=environment?.nativeWindow;
 if(!environment){try{if(isTauri())nativeWindow=getCurrentWindow();}catch{/* Fall back to browser visibility. */}}
 let disposed=false,generation=0,lastPaused:boolean|undefined;
 const unlisteners:(()=>void)[]=[];
 const publish=(paused:boolean)=>{
  if(!disposed&&paused!==lastPaused){lastPaused=paused;onPaused(paused);}
 };
 const refresh=async()=>{
  const snapshot=++generation;
  let paused=document_.hidden;
  if(nativeWindow){
   try{
    const [minimized,visible]=await Promise.all([nativeWindow.isMinimized(),nativeWindow.isVisible()]);
    if(typeof minimized==='boolean'&&typeof visible==='boolean')paused=minimized||!visible;
   }catch{paused=document_.hidden;}
  }
  if(!disposed&&snapshot===generation)publish(paused);
 };
 const onVisibility=()=>{void refresh();};
 document_.addEventListener('visibilitychange',onVisibility);
 if(nativeWindow){
  for(const subscribe of [()=>nativeWindow!.onResized(onVisibility),()=>nativeWindow!.onFocusChanged(onVisibility)]){
   try{
    void subscribe().then(unlisten=>{
     if(disposed){try{unlisten();}catch{/* Cleanup must not affect other listeners. */}}
     else{unlisteners.push(unlisten);void refresh();}
    }).catch(()=>{/* The initial read and document visibility fallback remain available. */});
   }catch{/* A failed native subscription must not block the app. */}
  }
 }
 void refresh();
 return()=>{
  if(disposed)return;
  disposed=true;generation++;
  document_.removeEventListener('visibilitychange',onVisibility);
  for(const unlisten of unlisteners){try{unlisten();}catch{/* Remove every remaining subscription. */}}
  unlisteners.length=0;
 };
}
