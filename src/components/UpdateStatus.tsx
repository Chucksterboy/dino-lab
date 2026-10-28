import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpCircle, Check, CircleHelp, ExternalLink, RefreshCw, WifiOff, X } from 'lucide-react';
import { APP_VERSION, checkForUpdates, checkForUpdatesOnLaunch, openUpdateRelease, updateStatusCopy } from '../lib/updates';
import type { UpdateCheck } from '../lib/updates';

export function UpdateStatus({reduceMotion=false}:{reduceMotion?:boolean}){
 const [result,setResult]=useState<UpdateCheck|null>(null),[checking,setChecking]=useState(true),[open,setOpen]=useState(false),[dismissed,setDismissed]=useState<string|null>(null),[opening,setOpening]=useState(false),[openError,setOpenError]=useState('');
 const trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{let active=true;void checkForUpdatesOnLaunch().then(value=>{if(active){setResult(value);setChecking(false);}});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(!open)return;
  const focusTimer=setTimeout(()=>closeButton.current?.focus(),0);
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setOpen(false);trigger.current?.focus();return;}
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.key==='Tab'){
    const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]')??[]);
    const first=items[0],last=items.at(-1);
    if(!dialog.current?.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}
    else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  window.addEventListener('keydown',onKey,true);
  return()=>{clearTimeout(focusTimer);window.removeEventListener('keydown',onKey,true);};
 },[open]);
 const available=result?.status==='available';
 const copy=updateStatusCopy(result,checking);
 const icon=checking?<RefreshCw size={22} className="update-spinning"/>:available?<ArrowUpCircle size={23}/>:result?.status==='offline'?<WifiOff size={21}/>:<RefreshCw size={22}/>;
 const recheck=async()=>{if(checking)return;setChecking(true);setOpenError('');const next=await checkForUpdates();setResult(next);setChecking(false);};
 const close=()=>{setOpen(false);trigger.current?.focus();};
 const viewRelease=async()=>{if(opening||!result?.releaseUrl)return;setOpening(true);setOpenError('');try{await openUpdateRelease(result.releaseUrl);}catch{setOpenError('The release page could not open. Please try again.');}finally{setOpening(false);}};
 return <>
  <button ref={trigger} className={`rail-button updates-trigger ${available?'update-available':''}`} aria-label="Updates" title={available?`New version available · ${result?.latestVersion}`:copy.heading} onClick={()=>setOpen(true)}>{icon}{available&&<span className="update-indicator"/>}</button>
  {createPortal(<div className={reduceMotion?'updates-surface reduce-motion':'updates-surface'}>
   <AnimatePresence>{available&&dismissed!==result.latestVersion&&!open&&<motion.aside className="update-notice" role="status" aria-live="polite" initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-5}}><span className="update-notice-icon"><ArrowUpCircle size={22}/></span><div><strong>New version available</strong><span>Dino Lab {result.latestVersion}</span><button className="text-button" onClick={()=>setOpen(true)}>View update <ExternalLink size={12}/></button></div><button className="btn-icon" aria-label="Dismiss update notice" onClick={()=>setDismissed(result.latestVersion)}><X size={15}/></button></motion.aside>}</AnimatePresence>
   {open&&<div className="modal-backdrop updates-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section ref={dialog} className="modal updates-dialog" role="dialog" aria-modal="true" aria-labelledby="updates-title"><div className="panel-heading"><h2 id="updates-title"><RefreshCw size={20}/> App updates</h2><button ref={closeButton} className="btn-icon" aria-label="Close updates" onClick={close}><X size={19}/></button></div><div className={`update-status-reading ${available?'is-available':''}`} aria-live="polite"><span className="update-status-symbol">{checking?<RefreshCw size={26} className="update-spinning"/>:available?<ArrowUpCircle size={29}/>:result?.status==='current'?<Check size={27}/>:result?.status==='offline'?<WifiOff size={27}/>:<CircleHelp size={27}/>}</span><h3>{copy.heading}</h3><p>{copy.description}</p></div><div className="update-versions"><div><span>Installed version</span><strong>{result?.currentVersion??APP_VERSION}</strong></div><div><span>Latest release</span><strong>{result?.latestVersion??'—'}</strong></div></div>{result?.releaseName&&<p className="update-release-name">{result.releaseName}</p>}{openError&&<p className="notice" role="alert">{openError}</p>}<div className="button-row update-actions"><button className="btn" aria-disabled={checking} onClick={()=>void recheck()}><RefreshCw size={15} className={checking?'update-spinning':''}/>{checking?'Checking…':'Check again'}</button>{available&&result.releaseUrl&&<button className="btn btn-primary" aria-disabled={opening} onClick={()=>void viewRelease()}>{opening?'Opening…':'View release'}<ExternalLink size={14}/></button>}</div><p className="update-check-note">Dino Lab checks GitHub Releases when it opens.</p></section></div>}
  </div>,document.body)}
 </>;
}
