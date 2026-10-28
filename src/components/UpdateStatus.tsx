import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpCircle, Check, CircleHelp, Download, ExternalLink, RefreshCw, WifiOff, X } from 'lucide-react';
import { APP_VERSION, canInstallUpdate, checkForUpdates, checkForUpdatesOnLaunch, installUpdate, openUpdateRelease, updateInstallCopy, updateStatusCopy } from '../lib/updates';
import type { UpdateCheck, UpdateInstallProgress } from '../lib/updates';

interface UpdateActionsProps {
 result:UpdateCheck|null;
 checking:boolean;
 installing:boolean;
 opening:boolean;
 installLabel?:string;
 onCheck:()=>void;
 onInstall:()=>void;
 onViewRelease:()=>void;
}

/** Shared actions keep install availability tied to the native verified feed. */
export function UpdateActions({result,checking,installing,opening,installLabel='Update now',onCheck,onInstall,onViewRelease}:UpdateActionsProps){
 const installable=canInstallUpdate(result),available=result?.status==='available';
 const busy=checking||installing;
 return <>
  <div className="button-row update-actions">
   <button className="btn" disabled={busy} aria-disabled={busy} onClick={onCheck}><RefreshCw size={15} className={checking?'update-spinning':''}/>{checking?'Checking…':'Check again'}</button>
   {installable&&<button className="btn btn-primary" disabled={busy||opening} aria-disabled={busy||opening} onClick={onInstall}><Download size={15}/>{installing?installLabel:'Update now'}</button>}
   {available&&result.releaseUrl&&!installable&&<button className="btn btn-primary" disabled={busy||opening} aria-disabled={busy||opening} onClick={onViewRelease}>{opening?'Opening…':'View release'}<ExternalLink size={14}/></button>}
  </div>
  {available&&result.releaseUrl&&installable&&<button className="text-button update-release-link" disabled={busy||opening} onClick={onViewRelease}>{opening?'Opening release…':'View release'}<ExternalLink size={12}/></button>}
 </>;
}

export function UpdateInstallReading({progress}:{progress:UpdateInstallProgress}){
 const copy=updateInstallCopy(progress);
 const percent=progress.totalBytes>0?Math.max(0,Math.min(100,Math.floor(progress.downloadedBytes/progress.totalBytes*100))):undefined;
 const value=progress.phase==='downloading'?percent:100;
 const megabytes=(bytes:number)=>(bytes/1024/1024).toFixed(1);
 return <div className="update-install-progress" role="status" aria-live="polite" aria-atomic="true">
  <div><strong>{copy.heading}</strong><span>{progress.phase==='downloading'&&percent!==undefined?`${percent}%`:progress.phase==='downloading'?'Connecting…':progress.phase==='verifying'?'Download complete':'Please wait…'}</span></div>
  <progress aria-label="Update download" max={100} value={value}/>
  {progress.phase==='downloading'&&progress.totalBytes>0&&<small>{megabytes(progress.downloadedBytes)} / {megabytes(progress.totalBytes)} MB</small>}
 </div>;
}

export function UpdateStatus({reduceMotion=false}:{reduceMotion?:boolean}){
 const [result,setResult]=useState<UpdateCheck|null>(null),[checking,setChecking]=useState(true),[open,setOpen]=useState(false),[dismissed,setDismissed]=useState<string|null>(null),[opening,setOpening]=useState(false),[openError,setOpenError]=useState('');
 const [installing,setInstalling]=useState(false),[progress,setProgress]=useState<UpdateInstallProgress|null>(null);
 const installingRef=useRef(false);
 const trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{let active=true;void checkForUpdatesOnLaunch().then(value=>{if(active){setResult(value);setChecking(false);}});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(!open)return;
  const focusTimer=setTimeout(()=>{if(installing)dialog.current?.focus();else closeButton.current?.focus();},0);
  const onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){
    event.preventDefault();event.stopImmediatePropagation();
    if(!installingRef.current){setOpen(false);trigger.current?.focus();}
    return;
   }
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopImmediatePropagation();return;}
   if(event.key==='Tab'){
    const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]);
    const first=items[0],last=items.at(-1);
    if(!first){event.preventDefault();dialog.current?.focus();}
    else if(!dialog.current?.contains(document.activeElement)){event.preventDefault();(event.shiftKey?last:first)?.focus();}
    else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  };
  window.addEventListener('keydown',onKey,true);
  return()=>{clearTimeout(focusTimer);window.removeEventListener('keydown',onKey,true);};
 },[open,installing]);
 const available=result?.status==='available',installable=canInstallUpdate(result);
 const copy=installing&&progress?updateInstallCopy(progress):updateStatusCopy(result,checking);
 const icon=checking||installing?<RefreshCw size={22} className="update-spinning"/>:available?<ArrowUpCircle size={23}/>:result?.status==='offline'?<WifiOff size={21}/>:<RefreshCw size={22}/>;
 const recheck=async()=>{if(checking||installingRef.current)return;setChecking(true);setOpenError('');const next=await checkForUpdates();setResult(next);setChecking(false);};
 const close=()=>{if(installingRef.current)return;setOpen(false);trigger.current?.focus();};
 const viewRelease=async()=>{if(opening||installingRef.current||checking||!result?.releaseUrl)return;setOpening(true);setOpenError('');try{await openUpdateRelease(result.releaseUrl);}catch{setOpenError('The release page could not open. Please try again.');}finally{setOpening(false);}};
 const beginInstall=async()=>{
  if(!installable||!result?.latestVersion||checking||opening||installingRef.current)return;
  installingRef.current=true;setInstalling(true);setOpen(true);setOpenError('');
  setProgress({phase:'downloading',downloadedBytes:0,totalBytes:0});
  try{
   await installUpdate(result.latestVersion,setProgress);
   // Native preparation has completed. Keep the controls locked while its
   // verified handoff closes this process and opens the installer.
   setProgress(previous=>({phase:'launching',downloadedBytes:previous?.downloadedBytes??0,totalBytes:previous?.totalBytes??0}));
  }catch(error){
   const message=typeof error==='string'?error:error instanceof Error?error.message:'';
   setOpenError(message.trim().slice(0,500)||'The update could not be prepared. Please try again.');
   installingRef.current=false;setInstalling(false);setProgress(null);
  }
 };
 const installLabel=progress?.phase==='launching'?'Opening installer…':progress?.phase==='verifying'?'Verifying…':'Downloading…';
 return <>
  <button ref={trigger} className={`rail-button updates-trigger ${available?'update-available':''}`} aria-label="Updates" title={installing?copy.heading:available?`New version available · ${result?.latestVersion}`:copy.heading} onClick={()=>setOpen(true)}>{icon}{available&&!installing&&<span className="update-indicator"/>}</button>
  {createPortal(<div className={reduceMotion?'updates-surface reduce-motion':'updates-surface'}>
   <AnimatePresence>{available&&dismissed!==result.latestVersion&&!open&&<motion.aside className="update-notice" role="status" aria-live="polite" initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-5}}><span className="update-notice-icon"><ArrowUpCircle size={22}/></span><div><strong>New version available</strong><span>Dino Lab {result.latestVersion}</span>{installable?<button className="btn btn-primary update-notice-install" disabled={checking||opening||installing} onClick={()=>void beginInstall()}><Download size={13}/>Update now</button>:<button className="text-button" onClick={()=>setOpen(true)}>View update <ExternalLink size={12}/></button>}</div><button className="btn-icon" aria-label="Dismiss update notice" onClick={()=>setDismissed(result.latestVersion)}><X size={15}/></button></motion.aside>}</AnimatePresence>
   {open&&<div className="modal-backdrop updates-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section ref={dialog} className="modal updates-dialog" role="dialog" aria-modal="true" aria-labelledby="updates-title" aria-busy={checking||installing} tabIndex={-1}>
    <div className="panel-heading"><h2 id="updates-title"><RefreshCw size={20}/> App updates</h2><button ref={closeButton} className="btn-icon" aria-label="Close updates" disabled={installing} onClick={close}><X size={19}/></button></div>
    <div className={`update-status-reading ${available?'is-available':''}`} aria-live="polite"><span className="update-status-symbol">{checking||installing?<RefreshCw size={26} className="update-spinning"/>:available?<ArrowUpCircle size={29}/>:result?.status==='current'?<Check size={27}/>:result?.status==='offline'?<WifiOff size={27}/>:<CircleHelp size={27}/>}</span><h3>{copy.heading}</h3><p>{copy.description}</p></div>
    <div className="update-versions"><div><span>Installed version</span><strong>{result?.currentVersion??APP_VERSION}</strong></div><div><span>Latest release</span><strong>{result?.latestVersion??'—'}</strong></div></div>
    {result?.releaseName&&<p className="update-release-name">{result.releaseName}</p>}
    {installing&&progress&&<UpdateInstallReading progress={progress}/>}
    {openError&&<p className="notice" role="alert">{openError}</p>}
    <UpdateActions result={result} checking={checking} installing={installing} opening={opening} installLabel={installLabel} onCheck={()=>void recheck()} onInstall={()=>void beginInstall()} onViewRelease={()=>void viewRelease()}/>
    <p className="update-check-note">{installable||installing?'Update now downloads and verifies the installer, then closes Dino Lab to install it.':'Dino Lab checks GitHub Releases when it opens.'}</p>
   </section></div>}
  </div>,document.body)}
 </>;
}
