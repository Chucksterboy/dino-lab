/** Decorative instrument data, never game statistics. Rendering stays separate
 * from scheduling so hidden/reduced-motion windows can have no active loop. */
const TAU=Math.PI*2;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const wrap=(value:number,range:number)=>((value%range)+range)%range;
const mint=(alpha:number)=>`rgba(135,240,180,${clamp(alpha,0,1)})`;
const green=(alpha:number)=>`rgba(64,160,106,${clamp(alpha,0,1)})`;

function noise(index:number,salt:number):number {
 let value=Math.imul(index+1,salt)^0x6d2b79f5;
 value=Math.imul(value^(value>>>15),value|1);
 value^=value+Math.imul(value^(value>>>7),value|61);
 return ((value^(value>>>14))>>>0)/4294967296;
}

const motes=Array.from({length:126},(_,index)=>({
 x:noise(index,73013),y:noise(index,53267),speed:3+noise(index,93763)*10,
 size:.35+noise(index,61717)*1.05,phase:noise(index,41113)*TAU,
}));
const helixDust=Array.from({length:246},(_,index)=>({
 y:noise(index,18313),offset:(noise(index,47237)-.5)*2,
 width:1+noise(index,99139)*18,size:.35+noise(index,51287)*.95,
 strand:index%2===0?1:-1,phase:noise(index,31741)*TAU,
}));
const sequences=Array.from({length:20},(_,row)=>Array.from({length:64},(_,column)=>'ACGT'[Math.floor(noise(row*64+column,75133)*4)]).join(''));
const binary=Array.from({length:14},(_,row)=>Array.from({length:50},(_,column)=>noise(row*50+column,67271)>.5?'1':'0').join(''));

function dot(ctx:CanvasRenderingContext2D,x:number,y:number,radius:number){
 ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
}

function edgeStrength(x:number,width:number):number {
 const distance=Math.min(x,width-x)/width;
 return .12+.88*(1-clamp((distance-.04)/.22,0,1));
}

function drawGrid(ctx:CanvasRenderingContext2D,width:number,height:number,edge:number){
 ctx.save();
 ctx.beginPath();ctx.rect(0,0,edge,height);ctx.rect(width-edge,0,edge,height);ctx.clip();
 ctx.strokeStyle=green(.12);ctx.lineWidth=.5;
 ctx.beginPath();
 const columns=Math.min(110,Math.ceil(width/38)),rows=Math.min(70,Math.ceil(height/38));
 const spacingX=Math.max(38,width/Math.max(1,columns)),spacingY=Math.max(38,height/Math.max(1,rows));
 for(let column=0;column<columns;column++){const x=10+column*spacingX;ctx.moveTo(x,0);ctx.lineTo(x,height);}
 for(let row=0;row<rows;row++){const y=16+row*spacingY;ctx.moveTo(0,y);ctx.lineTo(width,y);}
 ctx.stroke();
 ctx.fillStyle=mint(.25);
 for(let row=0;row<rows;row+=3){
  const y=16+row*spacingY;
  for(const x of [10+spacingX*2,width-spacingX*2-10]){
   ctx.fillRect(x-2.5,y-.5,5,1);ctx.fillRect(x-.5,y-2.5,1,5);
  }
 }
 ctx.restore();
}

function drawRing(ctx:CanvasRenderingContext2D,cx:number,cy:number,radius:number,time:number,direction:number){
 ctx.save();ctx.translate(cx,cy);
 const turn=time*.018*direction;
 ctx.lineWidth=.7;
 for(let ring=0;ring<3;ring++){
  const r=radius-ring*22;
  ctx.strokeStyle=green(ring===0?.3:.18);
  ctx.beginPath();
  for(let segment=0;segment<5;segment++){
   const start=turn+segment*TAU/5+ring*.17;
   ctx.moveTo(Math.cos(start)*r,Math.sin(start)*r);
   ctx.arc(0,0,r,start,start+TAU/5-.085);
  }
  ctx.stroke();
 }
 for(let tick=0;tick<54;tick++){
  const angle=tick*TAU/54+turn;
  const large=tick%6===0;
  const inner=radius-(large?9:4);
  ctx.strokeStyle=mint(large?.36:.17);
  ctx.beginPath();ctx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);
  ctx.lineTo(Math.cos(angle)*(radius+2),Math.sin(angle)*(radius+2));ctx.stroke();
 }
 const scan=turn+time*.075;
 ctx.strokeStyle=mint(.53);ctx.lineWidth=1.1;
 ctx.beginPath();ctx.arc(0,0,radius,scan,scan+.19);ctx.stroke();
 ctx.fillStyle=mint(.72);dot(ctx,Math.cos(scan+.19)*radius,Math.sin(scan+.19)*radius,1.65);
 ctx.restore();
}

function drawHelix(ctx:CanvasRenderingContext2D,width:number,height:number,time:number){
 const center=clamp(width*.064,63,164);
 const amplitude=clamp(width*.047,59,116);
 const top=-45,bottom=height+45;
 const period=clamp(height*.55,330,660);
 const phase=time*.14;
 const helixX=(y:number,strand:number)=>center+Math.sin(y/period*TAU+phase)*amplitude*strand;

 const glow=ctx.createRadialGradient(center,height*.44,5,center,height*.44,amplitude*2.7);
 glow.addColorStop(0,'rgba(27,115,68,.12)');glow.addColorStop(1,'rgba(10,47,28,0)');
 ctx.fillStyle=glow;ctx.fillRect(0,0,amplitude*4,height);

 // Low-opacity continuous strands support the brighter suspended points.
 for(const strand of [-1,1]){
  ctx.strokeStyle=mint(.28);ctx.lineWidth=.65;ctx.beginPath();
  const samples=176;
  for(let sample=0;sample<=samples;sample++){
   const y=top+(bottom-top)*sample/samples,x=helixX(y,strand);
   if(sample===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();
 }
 for(let rung=0;rung<48;rung++){
  const y=top+(bottom-top)*rung/47;
  const angle=y/period*TAU+phase;
  const a=helixX(y,-1),b=helixX(y,1);
  ctx.strokeStyle=green(.14+.13*Math.abs(Math.cos(angle)));ctx.lineWidth=.65;
  ctx.beginPath();ctx.moveTo(a,y);ctx.lineTo(b,y);ctx.stroke();
  for(const strand of [-1,1]){
   const front=(Math.cos(angle)*strand+1)/2;
   ctx.fillStyle=mint(.32+front*.35);dot(ctx,helixX(y,strand),y,front*1.05+.65);
  }
 }
 for(const point of helixDust){
  const y=wrap(point.y*(height+100)-time*(1.1+point.size),height+100)-50;
  const angle=y/period*TAU+phase;
  const x=helixX(y,point.strand)+point.offset*point.width;
  const front=(Math.cos(angle)*point.strand+1)/2;
  const shimmer=.72+.28*Math.sin(time*.6+point.phase);
  ctx.fillStyle=mint((.12+front*.35)*shimmer);dot(ctx,x,y,point.size);
 }
}

function drawTextBlock(ctx:CanvasRenderingContext2D,x:number,y:number,lines:number,chars:number,time:number,seed:number,isBinary=false){
 const values=isBinary?binary:sequences;
 ctx.font='8px Consolas, "Courier New", monospace';ctx.textAlign='left';ctx.textBaseline='top';
 const shift=Math.floor(time*.45);
 for(let row=0;row<lines;row++){
  const line=values[(row+seed)%values.length];
  const offset=(shift+row*3)%Math.max(1,line.length-chars);
  ctx.fillStyle=green(.16+.085*noise(row+seed,97241));
  ctx.fillText(line.slice(offset,offset+chars),x,y+row*10.5);
 }
}

function drawTelemetry(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,time:number,seed:number){
 ctx.lineWidth=.6;ctx.strokeStyle=green(.19);
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+width,y);ctx.moveTo(x,y-74);ctx.lineTo(x+width,y-74);ctx.stroke();
 const bars=25,step=width/bars;
 for(let index=0;index<bars;index++){
  const baseline=noise(index+seed,81119);
  const pulse=.65+.35*Math.sin(time*.31+index*.37+seed);
  const h=8+baseline*58*pulse;
  ctx.fillStyle=green(.18+baseline*.18);ctx.fillRect(x+index*step,y-h,Math.max(1,step*.35),h);
  if(index%4===0){ctx.fillStyle=mint(.45);ctx.fillRect(x+index*step,y-h-1.5,Math.max(1,step*.35),1);}
 }
}

function drawCoordinates(ctx:CanvasRenderingContext2D,x:number,y:number,time:number,seed:number){
 ctx.font='10px Consolas, "Courier New", monospace';ctx.textAlign='left';ctx.textBaseline='top';
 const step=Math.floor(time*1.4);
 for(let row=0;row<3;row++){
  const value=(noise(seed+row,43117)*2-1)*142+Math.sin(step*.13+row)*.027;
  ctx.fillStyle=mint(.53);ctx.fillText(value.toFixed(4),x,y+row*17);
 }
 ctx.strokeStyle=green(.25);ctx.lineWidth=.7;
 ctx.beginPath();ctx.moveTo(x-8,y-5);ctx.lineTo(x-8,y+49);ctx.lineTo(x+78,y+49);ctx.stroke();
}

function drawParticles(ctx:CanvasRenderingContext2D,width:number,height:number,time:number){
 for(const mote of motes){
  const x=wrap(mote.x*width+Math.sin(time*.035+mote.phase)*11,width);
  const y=wrap(mote.y*height-time*mote.speed*.18,height);
  const alpha=(.07+.08*Math.sin(time*.34+mote.phase)**2)*edgeStrength(x,width);
  ctx.fillStyle=mint(alpha);dot(ctx,x,y,mote.size);
 }
 // A few broad, extremely soft lenses establish depth without a blur filter.
 for(let index=0;index<6;index++){
  const x=wrap(noise(index,94157)*width+time*(index%2===0?1:-1),width);
  const y=wrap(noise(index,22441)*height-time*.5,height);
  const radius=6+noise(index,19141)*14;
  const glow=ctx.createRadialGradient(x,y,0,x,y,radius);
  glow.addColorStop(0,mint(.035*edgeStrength(x,width)));glow.addColorStop(1,mint(0));
  ctx.fillStyle=glow;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
 }
}

/** Paint one transparent Emerald Lab frame in CSS pixels. The caller owns
 * canvas clear, DPR scaling, resize, visibility, reduced motion and RAF. */
export function drawEmeraldBackground(ctx:CanvasRenderingContext2D,width:number,height:number,timeSeconds:number):void {
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
 const time=Number.isFinite(timeSeconds)?clamp(timeSeconds,0,Number.MAX_SAFE_INTEGER):0;
 const edge=clamp(width*.17,150,350);
 ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 drawGrid(ctx,width,height,edge);
 drawRing(ctx,-18,height*.34,clamp(width*.13,150,304),time,1);
 drawRing(ctx,width+22,height*.67,clamp(width*.145,170,350),time,-1);
 drawHelix(ctx,width,height,time);

 const leftInset=clamp(width*.015,12,38);
 const rightInset=width-clamp(width*.145,145,315);
 drawTextBlock(ctx,leftInset,28,8,Math.floor(edge/7.6),time,3);
 drawTextBlock(ctx,rightInset,36,11,Math.floor(edge/7),time,9);
 drawTextBlock(ctx,leftInset,height*.82,5,19,time,4,true);
 drawTextBlock(ctx,width-edge*.68,height*.38,8,11,time,1,true);
 drawCoordinates(ctx,clamp(width*.104,112,266),height*.61,time,6);
 drawCoordinates(ctx,width-clamp(width*.09,96,210),height*.82,time,12);
 drawTelemetry(ctx,width-edge*.9,height-28,edge*.84,time,11);
 drawTelemetry(ctx,leftInset,height*.89,edge*.58,time,4);
 drawParticles(ctx,width,height,time);

 // A slow diagonal sweep is strongest at the periphery and mostly above cards.
 ctx.save();ctx.translate(width*.7,height*.065+Math.sin(time*.047)*height*.08);ctx.rotate(-.31);
 const beam=ctx.createLinearGradient(0,-20,0,20);
 beam.addColorStop(0,mint(0));beam.addColorStop(.46,mint(.018));beam.addColorStop(.5,mint(.07));beam.addColorStop(.54,mint(.018));beam.addColorStop(1,mint(0));
 ctx.fillStyle=beam;ctx.fillRect(-width,-20,width*2,40);ctx.restore();
 ctx.restore();
}
