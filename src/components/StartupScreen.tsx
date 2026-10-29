import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { EmeraldBackground } from './EmeraldBackground';
import { watchWindowMotion } from '../lib/window-motion';

function savedReducedMotion():boolean{
 try{return JSON.parse(localStorage.getItem('dinolab-reduce-motion')??'false')===true;}
 catch{return false;}
}

export function StartupScreen({closing=false,error=false}:{closing?:boolean;error?:boolean}){
 const [reducedMotion]=useState(savedReducedMotion);
 const [suspended,setSuspended]=useState(()=>typeof document!=='undefined'&&document.hidden);
 useEffect(()=>watchWindowMotion(setSuspended),[]);

 return <div className={`startup startup-emerald ${closing?'startup-closing':''} ${reducedMotion?'reduce-motion':''} ${suspended?'motion-suspended':''}`} role="status" aria-label="Dino Lab is preparing the species database">
  <EmeraldBackground reducedMotion={reducedMotion||suspended}/>
  <div className="startup-foreground">
   <div className="startup-orbit"><span/><span/><div className="startup-symbol"><FlaskConical size={46} strokeWidth={1.3}/></div></div>
   <h1>DINO<span>LAB</span></h1><p>THE ISLE · SPECIES RESEARCH</p>
   <div className="startup-loading"><span/>{error?'The database could not open. Please restart Dino Lab.':'Preparing your field database'}</div>
  </div>
 </div>;
}
