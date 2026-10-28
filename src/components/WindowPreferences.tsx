import { useEffect, useState } from 'react';
import { getCloseToTray, setCloseToTray } from '../lib/desktop';

export function WindowPreferences(){
 const [enabled,setEnabled]=useState<boolean|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  void getCloseToTray().then(value=>{if(active)setEnabled(value);}).catch(()=>{if(active)setError('The window preference could not load. Please try again.');}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[]);
 const reload=async()=>{
  if(busy)return;
  setBusy(true);setError('');
  try{setEnabled(await getCloseToTray());}catch{setEnabled(null);setError('The window preference could not load. Please try again.');}finally{setBusy(false);}
 };
 const change=async(next:boolean)=>{
  if(busy||enabled===null)return;
  setBusy(true);setError('');
  try{setEnabled(await setCloseToTray(next));}
  catch{
   setError('The change could not be confirmed. Please try again.');
   try{setEnabled(await getCloseToTray());}catch{setEnabled(null);}
  }finally{setBusy(false);}
 };
 return <>
  <div className="preference-row" aria-busy={busy}><div><strong id="close-to-tray-label">Minimize on close</strong><p id="close-to-tray-description">Closing the window keeps Dino Lab in the system tray. Open it from the tray icon, or choose Exit Dino Lab to quit.</p></div><input type="checkbox" aria-labelledby="close-to-tray-label" aria-describedby="close-to-tray-description" checked={enabled??false} disabled={enabled===null} aria-disabled={busy||enabled===null} onChange={event=>void change(event.target.checked)}/></div>
  {error&&<div className="notice window-preference-error" role="alert"><p>{error}</p><button className="btn" aria-disabled={busy} onClick={()=>void reload()}>Retry</button></div>}
 </>;
}
