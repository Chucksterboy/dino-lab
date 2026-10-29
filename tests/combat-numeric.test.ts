import test from 'node:test';
import assert from 'node:assert/strict';
import { Children, createElement, isValidElement } from 'react';
import type { ChangeEvent, MouseEvent, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSample, getSpecies, species } from '../src/data/index.ts';
import { CombatArena as Attacks, attackEventKind, wildlifePrimaryDamage } from '../src/components/CombatArena.tsx';
import { GrowthChart } from '../src/components/Chart.tsx';

test('known wildlife Bite defaults to flat source damage; absent attacks remain unknown', () => {
  for (const [name, expected] of [['Boar',40],['Deer',null],['Goat',null]] as const) {
    const specimen=getSpecies(name)!;
    const sample=getSample(specimen,100,'Prime');
    assert.equal(sample?.values.bite,null,'wildlife has no invented bite-force curve');
    assert.equal(wildlifePrimaryDamage(specimen,sample),expected);
    const markup=renderToStaticMarkup(createElement(Attacks,{specimen,growth:100,state:'Prime',mechanics:specimen.mechanics}));
    if(expected!=null) {
      assert.ok(markup.includes(`Bite · ${expected} damage`));
      assert.match(markup,new RegExp(`Your damage \/ hit<\/span><strong[^>]*>${expected}<\/strong>`),'the actual result retains the known flat primary');
      assert.ok(!markup.includes('Primary damage at this growth:'),'the requested bottom notice is absent');
      assert.equal((markup.match(new RegExp(`>Bite · ${expected} damage<`,'g'))??[]).length,1,'no duplicate known primary option');
    } else assert.ok(markup.includes('Primary attack · — damage'));
  }
});

test('primary fallback does not replace real zero or a playable missing bite with another attack', () => {
  const boar=getSpecies('Boar')!,sample=getSample(boar,100,'Prime')!;
  assert.equal(wildlifePrimaryDamage(boar,{...sample,values:{...sample.values,bite:0}}),0);
  const allo=getSpecies('Allosaurus')!,alloSample=getSample(allo,75,'Prime')!;
  assert.equal(wildlifePrimaryDamage(allo,{...alloSample,values:{...alloSample.values,bite:null}}),null);
  assert.equal(wildlifePrimaryDamage(allo,alloSample),175);
});

test('source event classification distinguishes tick loops and unverified venom models', () => {
  const allMechanics=species.flatMap(s=>s.mechanics);
  const ticks=allMechanics.filter(m=>/per tick/i.test(m.description));
  const venom=allMechanics.filter(m=>/venom/i.test(m.name));
  assert.equal(ticks.length,8);
  assert.equal(venom.length,3);
  for(const mechanic of ticks)assert.equal(attackEventKind(mechanic),'tick',mechanic.name);
  for(const mechanic of venom)assert.equal(attackEventKind(mechanic),'model',mechanic.name);
  assert.equal(attackEventKind(),'hit');
  assert.equal(attackEventKind(getSpecies('Boar')!.mechanics[0]),'hit');
  const troodon=getSpecies('Troodon')!;
  const markup=renderToStaticMarkup(createElement(Attacks,{specimen:troodon,growth:50,state:'Prime',mechanics:troodon.mechanics}));
  assert.ok(markup.includes('Venom stage 1 · unverified model'));
  assert.ok(markup.includes('Pin loop · per tick'));
  assert.ok(!markup.includes('excluding bleed, venom,'),'selectable source venom is not silently excluded');
  assert.ok(!markup.includes('Displayed damage is rounded'));
});

test('selecting source tick and venom attacks updates actual matchup labels and caveats', () => {
  for(const [name,attackName,expectedLabel,expectedCaveat] of [
    ['Allosaurus','Grapple loop','Your damage / tick','Tick frequency is not inferred.'],
    ['Troodon','Venom stage 1','Your damage / modeled event','Unverified venom community model.'],
  ]){
    const specimen=getSpecies(name)!,mechanic=specimen.mechanics.find(m=>m.name===attackName)!;
    let selected=false;
    function Probe(){
      const tree=Attacks({specimen,growth:50,state:'Prime',mechanics:specimen.mechanics});
      const findSelect=(element:ReactElement):ReactElement<{id?:string,onChange:(event:ChangeEvent<HTMLSelectElement>)=>void}>|undefined=>{
        if(element.type==='select'&&(element.props as {id?:string}).id==='attack')return element as ReturnType<typeof findSelect>;
        for(const child of Children.toArray((element.props as {children?:React.ReactNode}).children))if(isValidElement(child)){const found=findSelect(child);if(found)return found;}
        return undefined;
      };
      if(!selected){selected=true;findSelect(tree)!.props.onChange({target:{value:mechanic.id}} as ChangeEvent<HTMLSelectElement>);}
      return tree;
    }
    const markup=renderToStaticMarkup(createElement(Probe));
    assert.ok(markup.includes(expectedLabel));
    assert.ok(markup.includes(expectedCaveat));
    assert.ok(markup.includes('Source-event model'));
    assert.ok(!markup.includes('Your damage / hit'));
  }
});

test('Source 2 chart identifies the exact Frail keyframe rather than rounding its growth', () => {
  const specimen=getSpecies('Allosaurus')!;
  const markup=renderToStaticMarkup(createElement(GrowthChart,{specimen,source:'sheet',state:'Frail',growth:87.5079,metric:'weight'}));
  assert.ok(markup.includes('Selected growth · 87.5079%'));
  assert.ok(markup.includes('Recorded value:'));
});

test('real Troodon venom curves unlock at 50% for each condition and stay absent from Source 2', () => {
  const specimen=getSpecies('Troodon')!;
  for(const state of ['Prime','Frail'] as const){
    const draw=(growth:number,source:'dashboard'|'sheet'='dashboard')=>renderToStaticMarkup(createElement(GrowthChart,{specimen,state,growth,metric:'bite',source}));
    assert.ok(!draw(49).includes('<title>Venom stage 1:'));
    assert.ok(draw(50).includes('<title>Venom stage 1:'));
    assert.ok(!draw(50,'sheet').includes('<title>Venom stage 1:'));
  }
});

test('chart click selects the same exact recorded point as hover, including fractional keyframes and ties', () => {
  const cases=[
    {name:'Triceratops',source:'sheet' as const,pointerGrowth:62.4992,expected:62.5,min:0},
    {name:'Triceratops',source:'sheet' as const,pointerGrowth:62.4982,expected:62.4981,min:0},
    {name:'Allosaurus',source:'dashboard' as const,pointerGrowth:25.5,expected:25,min:25},
  ];
  for(const item of cases){
    let moved=false,chosen:number|undefined;
    const specimen=getSpecies(item.name)!;
    function Probe(){
      // Server render-phase updates exercise the actual SVG handlers without a
      // browser, live application or DOM implementation.
      const tree=GrowthChart({specimen,source:item.source,state:'Prime',metric:'weight',onGrowth:value=>{chosen=value;}});
      const svg=Children.toArray(tree.props.children).find(child=>isValidElement(child)&&child.type==='svg') as ReactElement<{onMouseMove:(event:MouseEvent<SVGSVGElement>)=>void,onClick:()=>void}>;
      assert.ok(svg);
      if(!moved){
        moved=true;
        const clientX=53+(item.pointerGrowth-item.min)/(100-item.min)*(760-53-18);
        svg.props.onMouseMove({clientX,currentTarget:{getBoundingClientRect:()=>({left:0,width:760})}} as unknown as MouseEvent<SVGSVGElement>);
      }else svg.props.onClick();
      return tree;
    }
    const markup=renderToStaticMarkup(createElement(Probe));
    assert.equal(chosen,item.expected,`${item.name}/${item.source}/${item.pointerGrowth}`);
    assert.ok(markup.includes(`${item.expected}% growth`),'clicked point agrees with hover label');
  }
});
