import React, { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
import './readability.css';
import './updates.css';
import './mutations.css';
import './components/combat-mutations.css';
import './nav-motion.css';
import { FlaskConical } from 'lucide-react';

const INTRO_DURATION_MS=3500;
const INTRO_FADE_MS=300;

function Bootstrap(){
 const [Application,setApplication]=useState<ComponentType|null>(null),[closing,setClosing]=useState(false),[showIntro,setShowIntro]=useState(true),[error,setError]=useState(false);
 const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),removeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const close=()=>{if(closeTimer.current)clearTimeout(closeTimer.current);setClosing(true);removeTimer.current=setTimeout(()=>setShowIntro(false),INTRO_FADE_MS);};
 useEffect(()=>{
  let active=true;const started=performance.now();
  const pictures=Promise.all(['allosaurus','tyrannosaurus','triceratops','omniraptor'].map(id=>new Promise<void>(resolve=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>resolve();image.src=`/art/${id}.webp`;})));
  Promise.all([import('./App'),document.fonts.ready,pictures]).then(([module])=>{if(!active)return;setApplication(()=>module.default);closeTimer.current=setTimeout(close,Math.max(0,INTRO_DURATION_MS-INTRO_FADE_MS-(performance.now()-started)));}).catch(()=>{if(active)setError(true);});
  return()=>{active=false;if(closeTimer.current)clearTimeout(closeTimer.current);if(removeTimer.current)clearTimeout(removeTimer.current);};
 },[]);
 return <>{Application&&<Application/>}{showIntro&&<div className={`startup ${closing?'startup-closing':''}`} role="status" aria-label="Dino Lab is preparing the species database"><div className="startup-orbit"><span/><span/><div className="startup-symbol"><FlaskConical size={46} strokeWidth={1.3}/></div></div><h1>DINO<span>LAB</span></h1><p>THE ISLE · SPECIES RESEARCH</p><div className="startup-loading"><span/>{error?'The database could not open. Please restart Dino Lab.':'Preparing your field database'}</div></div>}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Bootstrap/></React.StrictMode>);
