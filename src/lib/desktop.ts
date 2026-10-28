import { invoke, isTauri } from '@tauri-apps/api/core';

async function closePreference(command:string,args?:Record<string,unknown>):Promise<boolean>{
 if(!isTauri())throw new Error('Window preferences are available in the Windows application.');
 const value=await invoke<unknown>(command,args);
 if(typeof value!=='boolean')throw new Error('The saved window preference could not be read.');
 return value;
}

export function getCloseToTray():Promise<boolean>{return closePreference('get_close_to_tray');}
export async function setCloseToTray(enabled:boolean):Promise<boolean>{
 const saved=await closePreference('set_close_to_tray',{enabled});
 if(saved!==enabled)throw new Error('The window preference was not saved.');
 return saved;
}
