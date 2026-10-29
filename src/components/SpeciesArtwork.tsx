import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import type { Species } from '../data';
import { artFor } from '../lib/ui';

const heavySpecies=new Set(['diabloceratops','kentrosaurus','maiasaura','stegosaurus','triceratops','tyrannosaurus']);
const lightSpecies=new Set(['austroraptor','beipiosaurus','beipiaosaurus','dryosaurus','gallimimus','herrerasaurus','hypsilophodon','omniraptor','troodon']);

export function SpeciesArtwork({specimen,eager=false,variant='card'}:{specimen:Species;eager?:boolean;variant?:'card'|'hero'}){
 const ref=useRef<HTMLSpanElement>(null);
 const seed=Array.from(specimen.id).reduce((value,character)=>(value*31+character.charCodeAt(0))>>>0,0);
 const profile=specimen.id==='pteranodon'?'glide':specimen.id==='deinosuchus'?'low':heavySpecies.has(specimen.id)?'heavy':lightSpecies.has(specimen.id)?'light':'idle';
 const style={'--dino-idle-period':`${(profile==='heavy'?8:6)+(seed%25)/10}s`,'--dino-idle-phase':`${-(seed%101)/10}s`} as CSSProperties;

 useEffect(()=>{
  const element=ref.current;if(!element)return;
  let visible=typeof IntersectionObserver==='undefined';
  const sync=()=>{element.dataset.motionActive=String(visible&&!document.hidden);};
  const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(entries=>{
   visible=entries.some(entry=>entry.isIntersecting);sync();
  },{rootMargin:'40px'});
  observer?.observe(element);
  document.addEventListener('visibilitychange',sync);
  sync();
  return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',sync);};
 },[specimen.id]);

 return <span ref={ref} className={`dino-art-motion${variant==='hero'?' dino-art-motion--hero':''}`} data-motion-profile={profile} data-motion-active="false" style={style} aria-hidden={variant==='card'?true:undefined}>{variant==='hero'?<motion.img key={specimen.id} src={artFor(specimen)} alt={`${specimen.name} species artwork`} loading="eager" draggable={false} initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} transition={{duration:.35}}/>:<img src={artFor(specimen)} alt="" loading={eager?'eager':'lazy'} draggable={false}/>}</span>;
}
