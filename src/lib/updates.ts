import { invoke, isTauri } from '@tauri-apps/api/core';
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
 message:string|null;
 checkedAtUnix:number;
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

let activeRequest:Promise<UpdateCheck>|null=null;
let launchRequest:Promise<UpdateCheck>|null=null;
function unavailable(message:string):UpdateCheck{return {status:'unavailable',currentVersion:APP_VERSION,latestVersion:null,releaseUrl:null,releaseName:null,publishedAt:null,message,checkedAtUnix:Math.floor(Date.now()/1000)};}

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
