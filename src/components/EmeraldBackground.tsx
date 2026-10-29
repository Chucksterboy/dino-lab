import { useEffect, useRef } from 'react';
import { drawEmeraldBackground } from '../lib/emerald-background';
import { startBackgroundMotion } from '../lib/background-motion';

export function EmeraldBackground({reducedMotion}:{reducedMotion:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  if(!canvas.current)return;
  return startBackgroundMotion(canvas.current,drawEmeraldBackground,reducedMotion);
 },[reducedMotion]);

 return <div className="emerald-background" aria-hidden="true">
  <canvas ref={canvas} className="emerald-background-canvas" data-motion-active="false"/>
  <img className="emerald-background-skull" src="/backgrounds/emerald-skull.png" alt="" draggable={false} decoding="async" onError={event=>{event.currentTarget.style.display='none';}}/>
 </div>;
}
