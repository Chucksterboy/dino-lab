import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { version } from '../../package.json';

export const APP_VERSION=version;
export type UpdateState='available'|'current'|'unpublished'|'unavailable'|'offline'|'rate_limited';
export interface UpdateCheck {
 status:UpdateState;
 currentVersion:string;
 latestVersion:string|null;
 releaseUrl:string|null;
 releaseName:string|null;
 publishedAt:string|null;
 installerAvailable:boolean;
 message:string|null;
 checkedAtUnix:number;
}
export interface UpdateInstallProgress {
 phase:'downloading'|'verifying'|'launching';
 downloadedBytes:number;
 totalBytes:number;
}

export function updateStatusCopy(result:UpdateCheck|null,checking=false):{heading:string;description:string}{
 if(checking)return {heading:'Checking for updates',description:'Looking for the latest Dino Lab release.'};
 if(!result)return {heading:'Updates',description:'Check for a new version of Dino Lab.'};
 switch(result.status){
  case 'available':return {heading:'New version available',description:`Dino Lab ${result.latestVersion??''} is available.`};
  case 'current':return {heading:'You’re up to date',description:'No newer version of Dino Lab is available.'};
  case 'unpublished':return {heading:'No release published yet',description:'You’ll be notified when a new version is published.'};
  case 'offline':return {heading:'You’re offline',description:'Connect to the internet and check again. Dino Lab remains ready to use.'};
  case 'rate_limited':return {heading:'Please try again later',description:'GitHub is temporarily limiting update checks.'};
  default:return {heading:'Unable to check for updates',description:'Release information isn’t available right now. Please try again later.'};
 }
}

export function updateInstallCopy(progress:UpdateInstallProgress):{heading:string;description:string}{
 switch(progress.phase){
  case 'verifying':return {heading:'Verifying installer',description:'Checking the download before opening the Windows installer.'};
  case 'launching':return {heading:'Opening installer',description:'Dino Lab is closing so Windows can install the new version.'};
  default:return {heading:'Downloading update',description:'Dino Lab will close and open the installer when the download is ready.'};
 }
}
export function canInstallUpdate(result:UpdateCheck|null):boolean{
 return result?.status==='available'&&result.installerAvailable===true&&Boolean(result.latestVersion);
}

let activeRequest:Promise<UpdateCheck>|null=null;
let launchRequest:Promise<UpdateCheck>|null=null;
function unavailable(message:string):UpdateCheck{return {status:'unavailable',currentVersion:APP_VERSION,latestVersion:null,releaseUrl:null,releaseName:null,publishedAt:null,installerAvailable:false,message,checkedAtUnix:Math.floor(Date.now()/1000)};}

/** One shared request prevents duplicate launch checks under React StrictMode. */
export function checkForUpdates():Promise<UpdateCheck>{
 if(activeRequest)return activeRequest;
 const request=isTauri()?invoke<UpdateCheck>('check_for_updates').catch(()=>unavailable('The update check could not complete.')):Promise.resolve(unavailable('Update checks are available in the Windows application.'));
 activeRequest=request;
 void request.finally(()=>{if(activeRequest===request)activeRequest=null;});
 return request;
}
export function checkForUpdatesOnLaunch():Promise<UpdateCheck>{return launchRequest??=checkForUpdates();}
export async function openUpdateRelease(url:string):Promise<void>{
 if(!isTauri())throw new Error('Open this release from the Windows application.');
 await invoke('open_update_release',{url});
}

interface InstallOperation {
 version:string;
 request:Promise<void>;
 listeners:Set<(progress:UpdateInstallProgress)=>void>;
 progress:UpdateInstallProgress|null;
}
let activeInstall:InstallOperation|null=null;
function progressValue(value:unknown):UpdateInstallProgress|null{
 if(!value||typeof value!=='object')return null;
 const candidate=value as Record<string,unknown>;
 if(!['downloading','verifying','launching'].includes(String(candidate.phase)))return null;
 const total=candidate.totalBytes,downloaded=candidate.downloadedBytes;
 if(typeof total!=='number'||!Number.isFinite(total)||total<0||typeof downloaded!=='number'||!Number.isFinite(downloaded)||downloaded<0)return null;
 return {phase:candidate.phase as UpdateInstallProgress['phase'],totalBytes:total,downloadedBytes:total>0?Math.min(downloaded,total):downloaded};
}
function notifyProgress(operation:InstallOperation,progress:UpdateInstallProgress){
 operation.progress=progress;
 for(const listener of operation.listeners){try{listener({...progress});}catch{/* A display callback cannot interrupt a verified native update. */}}
}

/** Installation is a separate explicit action. The native command refetches the
 * configured release and verifies its installer; no URL/path is accepted here.
 */
export function installUpdate(expectedVersion:string,onProgress?:(progress:UpdateInstallProgress)=>void):Promise<void>{
 if(!isTauri())return Promise.reject(new Error('Install updates from the Windows application.'));
 if(!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(expectedVersion))return Promise.reject(new Error('Check again before installing this update.'));
 if(activeInstall){
  if(activeInstall.version!==expectedVersion)return Promise.reject(new Error('An update is already being prepared.'));
  if(onProgress){activeInstall.listeners.add(onProgress);if(activeInstall.progress){try{onProgress({...activeInstall.progress});}catch{/* Keep the native operation independent from rendering. */}}}
  return activeInstall.request;
 }
 const operation:InstallOperation={version:expectedVersion,request:Promise.resolve(),listeners:new Set(onProgress?[onProgress]:[]),progress:null};
 const request=(async()=>{
  let unlisten:(()=>void)|undefined;
  try{
   unlisten=await listen<unknown>('update-install-progress',event=>{const progress=progressValue(event.payload);if(progress)notifyProgress(operation,progress);});
   await invoke<void>('install_update',{expectedVersion});
  }finally{
   // Windows may close the webview immediately after a successful handoff.
   // Cleanup failure must not turn that successful handoff into an error.
   try{await unlisten?.();}catch{/* The webview may already be shutting down. */}
  }
 })();
 operation.request=request;activeInstall=operation;
 void request.then(()=>{if(activeInstall===operation)activeInstall=null;},()=>{if(activeInstall===operation)activeInstall=null;});
 return request;
}
