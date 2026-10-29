export type BackgroundPainter=(context:CanvasRenderingContext2D,width:number,height:number,timeSeconds:number)=>void;

const FRAME_INTERVAL=1000/30;
const MAX_BACKING_PIXELS=3_000_000;
const MAX_BACKING_EDGE=8192;
const MAX_LOGICAL_EDGE=32768;

/** Owns decorative rendering only. No animation frame or listener survives cleanup. */
export function startBackgroundMotion(canvas:HTMLCanvasElement,draw:BackgroundPainter,reducedMotion:boolean):()=>void{
 canvas.dataset.motionActive='false';
 const document_=canvas.ownerDocument;
 const window_=document_.defaultView;
 if(!window_)return()=>{};
 let context:CanvasRenderingContext2D|null;
 try{context=canvas.getContext('2d',{alpha:true});}catch{return()=>{};}
 if(!context)return()=>{};
 const ctx=context;
 let disposed=false,failed=false,frame:number|null=null;
 let width=0,height=0,scale=1,elapsed=0,lastPaint=0,lastTimestamp:number|null=null;
 let media:MediaQueryList|undefined;
 try{media=window_.matchMedia?.('(prefers-reduced-motion: reduce)');}catch{/* Static artwork still works without a media-query API. */}

 function stop(){
  if(frame!==null){window_!.cancelAnimationFrame(frame);frame=null;}
  lastTimestamp=null;
  canvas.dataset.motionActive='false';
 }
 function paint(time:number){
  if(disposed||failed||width<=0||height<=0)return;
  try{
   ctx.setTransform(scale,0,0,scale,0,0);
   ctx.clearRect(0,0,width,height);
   draw(ctx,width,height,time);
  }catch{failed=true;stop();}
 }
 function canAnimate(){return !disposed&&!failed&&!reducedMotion&&!media?.matches&&!document_.hidden&&width>0&&height>0;}
 function tick(timestamp:number){
  frame=null;
  if(!canAnimate()){stop();return;}
  if(lastTimestamp!==null)elapsed+=Math.max(0,Math.min(timestamp-lastTimestamp,100));
  lastTimestamp=timestamp;
  if(elapsed-lastPaint>=FRAME_INTERVAL-1e-6){paint(elapsed/1000);lastPaint=elapsed;}
  if(canAnimate())frame=window_!.requestAnimationFrame(tick);
 }
 function sync(){
  if(!canAnimate()){stop();return;}
  if(frame===null){canvas.dataset.motionActive='true';frame=window_!.requestAnimationFrame(tick);}
 }
 function measure(){
  if(disposed||failed)return;
  const bounds=canvas.getBoundingClientRect();
  const nextWidth=Number.isFinite(bounds.width)&&bounds.width>0?Math.min(bounds.width,MAX_LOGICAL_EDGE):0;
  const nextHeight=Number.isFinite(bounds.height)&&bounds.height>0?Math.min(bounds.height,MAX_LOGICAL_EDGE):0;
  const dpr=Number.isFinite(window_!.devicePixelRatio)&&window_!.devicePixelRatio>0?Math.min(window_!.devicePixelRatio,1.5):1;
  const nextScale=nextWidth&&nextHeight?Math.min(dpr,Math.sqrt(MAX_BACKING_PIXELS/(nextWidth*nextHeight)),MAX_BACKING_EDGE/nextWidth,MAX_BACKING_EDGE/nextHeight):1;
  const backingWidth=nextWidth&&nextHeight?Math.max(1,Math.floor(nextWidth*nextScale)):0;
  const backingHeight=nextWidth&&nextHeight?Math.max(1,Math.floor(nextHeight*nextScale)):0;
  const changed=nextWidth!==width||nextHeight!==height||nextScale!==scale||canvas.width!==backingWidth||canvas.height!==backingHeight;
  width=nextWidth;height=nextHeight;scale=nextScale;
  if(changed){
   if(canvas.width!==backingWidth)canvas.width=backingWidth;
   if(canvas.height!==backingHeight)canvas.height=backingHeight;
   paint(reducedMotion||media?.matches?0:elapsed/1000);
  }
  sync();
 }
 const onVisibility=()=>sync();
 const onMedia=()=>{
  if(reducedMotion||media?.matches){elapsed=0;lastPaint=0;paint(0);}
  sync();
 };
 const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);
 observer?.observe(canvas);
 document_.addEventListener('visibilitychange',onVisibility);
 window_.addEventListener('resize',measure);
 if(media?.addEventListener)media.addEventListener('change',onMedia);
 else media?.addListener(onMedia);
 measure();
 return()=>{
  if(disposed)return;
  disposed=true;stop();observer?.disconnect();
  document_.removeEventListener('visibilitychange',onVisibility);
  window_.removeEventListener('resize',measure);
  if(media?.removeEventListener)media.removeEventListener('change',onMedia);
  else media?.removeListener(onMedia);
 };
}
