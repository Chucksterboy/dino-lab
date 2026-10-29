/** Decorative fossil-scanner calibration graphics. These are illustration
 * coordinates, never measurements or values from the species dataset. */
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const ink=(alpha:number)=>`rgba(135,240,180,${clamp(alpha,0,1)})`;

function line(ctx:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number){
 ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
}

function target(ctx:CanvasRenderingContext2D,x:number,y:number,radius:number,pulse:number){
 ctx.strokeStyle=ink(.13+pulse*.08);ctx.beginPath();
 line(ctx,x-radius,y,x-3,y);line(ctx,x+3,y,x+radius,y);
 line(ctx,x,y-radius,x,y-3);line(ctx,x,y+3,x,y+radius);
 ctx.stroke();ctx.fillStyle=ink(.3+pulse*.12);ctx.fillRect(x-.8,y-.8,1.6,1.6);
}

/** Paint into the transparent scene, with the fossil artwork supplied by its
 * sibling image layer. The motion controller owns clearing, sizing and time. */
export function drawFossilBlueprint(ctx:CanvasRenderingContext2D,width:number,height:number,timeSeconds:number):void {
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
 const time=Number.isFinite(timeSeconds)?clamp(timeSeconds,0,Number.MAX_SAFE_INTEGER):0;
 const left=width*.165,right=width*.855,top=height*.025,bottom=height*.975;
 const span=right-left,depth=bottom-top;
 const point=(x:number,y:number)=>[left+span*x,top+depth*y] as const;
 ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 ctx.beginPath();ctx.rect(left,top,span,depth);ctx.clip();ctx.lineWidth=.6;

 // A continuous drafting surface makes the exposed center one coherent scene.
 ctx.strokeStyle=ink(.065);ctx.beginPath();
 for(let column=0;column<=12;column++){
  const x=left+span*column/12;line(ctx,x,top,x,bottom);
 }
 for(let row=0;row<=14;row++){
  const y=top+depth*row/14;line(ctx,left,y,right,y);
 }
 ctx.stroke();

 // Sparse anatomical anchor marks extend through the header, card gutters and
 // the large exposed area below the library's final row.
 const anchors=[[.09,.12],[.36,.08],[.7,.11],[.94,.3],[.43,.48],[.08,.69],[.67,.73],[.34,.94],[.88,.9]] as const;
 for(let index=0;index<anchors.length;index++){
  const anchor=anchors[index],[x,y]=point(anchor[0],anchor[1]);
  target(ctx,x,y,Math.max(3,Math.min(14,span*.009)),.5+.5*Math.sin(time*.38+index*1.7));
 }

 // Bracketed study areas, rather than extra opaque panels over the interface.
 ctx.strokeStyle=ink(.17);ctx.beginPath();
 for(const [cx,cy,w,h] of [[.24,.105,.42,.13],[.76,.29,.23,.26],[.63,.86,.55,.2]]){
  const [x,y]=point(cx-w/2,cy-h/2),ww=span*w,hh=depth*h;
  const corner=Math.min(14,ww*.12,hh*.2);
  line(ctx,x,y+corner,x,y);line(ctx,x,y,x+corner,y);
  line(ctx,x+ww-corner,y,x+ww,y);line(ctx,x+ww,y,x+ww,y+corner);
  line(ctx,x,y+hh-corner,x,y+hh);line(ctx,x,y+hh,x+corner,y+hh);
  line(ctx,x+ww-corner,y+hh,x+ww,y+hh);line(ctx,x+ww,y+hh,x+ww,y+hh-corner);
 }
 ctx.stroke();

 // Short rulers leave the bones and dinosaur cards as the visual subject.
 ctx.strokeStyle=ink(.23);ctx.beginPath();
 for(const [start,at,length] of [[.035,.185,.37],[.52,.67,.31],[.37,.96,.5]]){
  const [x,y]=point(start,at),ww=span*length;
  line(ctx,x,y,x+ww,y);
  for(let tick=0;tick<=12;tick++){
   const xx=x+ww*tick/12,hh=tick%3===0?5:2.5;
   line(ctx,xx,y-hh,xx,y+hh);
  }
 }
 ctx.stroke();

 // One soft scan plane traverses the illustration, with restrained bright
 // leading segments. At reduced motion, time zero still has a complete scene.
 const phase=(time/24+.16)%1,scanY=top+depth*phase;
 const feather=Math.max(1,Math.min(42,depth*.055));
 const wash=ctx.createLinearGradient(0,scanY-feather,0,scanY+feather);
 wash.addColorStop(0,ink(0));wash.addColorStop(.49,ink(.045));
 wash.addColorStop(.5,ink(.13));wash.addColorStop(.54,ink(.035));wash.addColorStop(1,ink(0));
 ctx.fillStyle=wash;ctx.fillRect(left,scanY-feather,span,feather*2);
 ctx.strokeStyle=ink(.3);ctx.beginPath();
 line(ctx,left,scanY,left+span*.16,scanY);line(ctx,right-span*.12,scanY,right,scanY);ctx.stroke();

 // Fine readouts update slowly; no per-frame randomness, DOM access or IPC.
 ctx.font='9px Consolas, "Courier New", monospace';ctx.textAlign='left';ctx.textBaseline='top';
 const step=Math.floor(time*.75);
 for(const [index,x,y] of [[0,.46,.055],[1,.73,.54],[2,.37,.84]]){
  const [px,py]=point(x,y);
  for(let row=0;row<3;row++){
   const value=12.4+index*17.73+row*6.125+Math.sin(step*.17+index+row)*.019;
   ctx.fillStyle=ink(row===0?.34:.23);ctx.fillText(value.toFixed(3),px,py+row*13);
  }
 }
 ctx.restore();
}
