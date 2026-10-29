import React, { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
import './readability.css';
import './art-motion.css';
import './emerald-background.css';
import './updates.css';
import './mutations.css';
import './components/combat-mutations.css';
import './nav-motion.css';
import { StartupScreen } from './components/StartupScreen';

const INTRO_DURATION_MS=3500;
const INTRO_FADE_MS=300;

function Bootstrap(){
 const [Application,setApplication]=useState<ComponentType<{introVisible?:boolean}>|null>(null),[closing,setClosing]=useState(false),[showIntro,setShowIntro]=useState(true),[error,setError]=useState(false);
 const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),removeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const close=()=>{if(closeTimer.current)clearTimeout(closeTimer.current);setClosing(true);removeTimer.current=setTimeout(()=>setShowIntro(false),INTRO_FADE_MS);};
 useEffect(()=>{
  let active=true;const started=performance.now();
  const pictures=Promise.all(['allosaurus','tyrannosaurus','triceratops','omniraptor'].map(id=>new Promise<void>(resolve=>{const image=new Image();image.onload=()=>resolve();image.onerror=()=>resolve();image.src=`/art/${id}.webp`;})));
  Promise.all([import('./App'),document.fonts.ready,pictures]).then(([module])=>{if(!active)return;setApplication(()=>module.default);closeTimer.current=setTimeout(close,Math.max(0,INTRO_DURATION_MS-INTRO_FADE_MS-(performance.now()-started)));}).catch(()=>{if(active)setError(true);});
  return()=>{active=false;if(closeTimer.current)clearTimeout(closeTimer.current);if(removeTimer.current)clearTimeout(removeTimer.current);};
 },[]);
 return <>{Application&&<Application introVisible={showIntro}/>}{showIntro&&<StartupScreen closing={closing} error={error}/>}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Bootstrap/></React.StrictMode>);
