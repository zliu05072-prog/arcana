// Botanical stages and potion tiers are deterministic views of on-chain amounts.
export const SPECIES = [
  {id:'moonveil', name:'Moonveil Lily', domain:'THE LUNAR ARCHIVE', color:'#c1afff', note:'A silver-veined bloom that gathers forgotten moonlight between its petals.'},
  {id:'emberthorn', name:'Emberthorn Rose', domain:'THE ASHEN HIGHLANDS', color:'#f1a270', note:'Born in the cinders of sleeping dragons. Its petals glow, but never burn.'},
  {id:'starcap', name:'Astral Starcap', domain:'THE DREAMING WOODS', color:'#87d6c4', note:'A constellation of tiny mushrooms, said to illuminate paths between dreams.'}
];
export const INFUSIONS = [
  {id:'moon',name:'Moon Salt',adjective:'Lunar',color:'#baa9f4',note:'Gathered where moonlight touches the sea.'},
  {id:'ember',name:'Ember Dust',adjective:'Ember',color:'#eea174',note:'A warm spark from a dragon’s abandoned nest.'},
  {id:'dream',name:'Dream Pollen',adjective:'Dream',color:'#86ceb8',note:'A little stardust, caught before waking.'}
];
export function growth(raised,goal) {
  const percent=goal>0n?Number(raised*10000n/goal)/100:0;
  const stage=raised===0n?0:percent<25?1:percent<75?2:percent<100?3:4;
  return {percent:Math.min(100,percent),stage,name:['Dormant seed','First awakening','Arcane foliage','Gathering magic','Celestial bloom'][stage]};
}
export function speciesFor(description='',id=0) {
  const match=description.match(/^\[Arcana:(moonveil|emberthorn|starcap)\]\n/);
  return {species:match?SPECIES.find(s=>s.id===match[1]):SPECIES[id%SPECIES.length],story:match?description.slice(match[0].length):description};
}
export function encodeStory(species,story) {
  if(!SPECIES.some(s=>s.id===species))throw new Error('Choose a botanical species.');
  return `[Arcana:${species}]\n${story.trim()}`;
}
export function potionFor(wei,infusion='moon') {
  if(wei<=0n)throw new Error('Enter a positive amount of test ETH.');
  const rank=wei<500000000000000n?0:wei<1000000000000000n?1:wei<2000000000000000n?2:3;
  const base=[
    {name:'Whisperdew Tonic',tier:'I · APPRENTICE',range:'Below 0.0005 ETH',recipe:'Dew of first light',symbol:'☽'},
    {name:'Moonwell Draught',tier:'II · ADEPT',range:'0.0005–<0.001 ETH',recipe:'Water from a hidden moonwell',symbol:'✧'},
    {name:'Starfire Elixir',tier:'III · ENCHANTER',range:'0.001–<0.002 ETH',recipe:'Essence of a wandering star',symbol:'✦'},
    {name:'Phoenix Nectar',tier:'IV · MASTER',range:'0.002 ETH and above',recipe:'A phoenix’s first golden tear',symbol:'❋'}
  ][rank];
  return {...base,rank,infusion:INFUSIONS.find(i=>i.id===infusion)||INFUSIONS[0]};
}
export function plantSVG(stage,variant=0) {
  const idx=typeof variant==='string'?Math.max(0,SPECIES.findIndex(s=>s.id===variant)):variant%3;
  const palettes=[['#b9a4ef','#ddd1fa','#8da49b'],['#ed9568','#f9ce8a','#97956e'],['#74c9b5','#bdeee0','#7caaa0']];
  const [petal,light,leaf]=palettes[idx];
  const top=[225,182,128,89,67][stage];
  let foliage='';
  if(stage>0)foliage=`<path d="M150 258Q143 200 150 ${top+10}" fill="none" stroke="${leaf}" stroke-width="4"/><path d="M148 216q-38-2-44-37 34 4 44 37m3-21q38-5 47-38-32 7-47 38" fill="${leaf}" opacity=".9"/>${stage>1?`<path d="M150 169q-40-8-43-42 33 8 43 42m2-20q33-6 39-37-29 7-39 37" fill="${leaf}"/><path d="m112 136 35 30m35-47-28 28" stroke="${light}" opacity=".3"/>`:''}`;
  let head='';
  if(stage===0)head=`<path d="M150 249q-27-14 0-43 28 30 0 43" fill="${petal}"/><path d="m150 212-5 17 5 12 6-12Z" fill="${light}" opacity=".6"/>`;
  else if(stage<3)head=`<path d="M150 ${top+20}q-23-13-16-31 24 3 16 31m0 0q23-13 16-31-24 3-16 31" fill="${petal}" opacity=".85"/>`;
  else if(idx===2)head=`<path d="M${stage===4?'89':'117'} ${top+23}Q150 ${top-58} ${stage===4?'211':'183'} ${top+23}Q150 ${top+47} ${stage===4?'89':'117'} ${top+23}" fill="${petal}"/><path d="M103 ${top+27}q47 19 94 0" stroke="${light}" fill="none" stroke-width="4"/><circle cx="139" cy="${top-1}" r="7" fill="${light}"/><circle cx="173" cy="${top+10}" r="5" fill="${light}"/><path d="M150 ${top-21}v-14m-7 7h14" stroke="${light}" stroke-width="2"/>`;
  else if(stage===3)head=`<path d="M150 ${top+20}C107 ${top-3} 141 ${top-34} 150 ${top-37}c18 12 34 38 0 57" fill="${petal}"/><path d="M150 ${top+20}v-40" stroke="${light}" opacity=".7"/>`;
  else head=`<g class="flower-head" style="transform-origin:150px ${top}px">${Array.from({length:idx===0?6:8},(_,i)=>`<path d="M150 ${top+6}Q119 ${top-25} 150 ${top-49}Q181 ${top-25} 150 ${top+6}" fill="${i%2?petal:light}" transform="rotate(${i*(idx===0?60:45)} 150 ${top})" opacity=".92"/>`).join('')}<circle cx="150" cy="${top}" r="13" fill="#f3db9c"/><path d="m150 ${top-8} 3 5 5 3-5 3-3 5-3-5-5-3 5-3Z" fill="#fff4d7"/></g>`;
  const mushrooms=idx===2&&stage>=2?`<path d="M120 254v-35m64 36v-47" stroke="${leaf}" stroke-width="4"/><path d="M99 221q20-38 42 0-21 14-42 0m62-13q23-42 45 0-23 15-45 0" fill="${petal}"/><circle cx="120" cy="212" r="3" fill="${light}"/><circle cx="184" cy="197" r="4" fill="${light}"/>`:'';
  return `<svg class="plant plant-stage-${stage} species-${idx}" viewBox="0 0 300 320" aria-hidden="true"><ellipse cx="150" cy="290" rx="86" ry="15" fill="${petal}" opacity=".06"/><g class="plant-stem">${foliage}${head}${mushrooms}</g>${stage===4?`<g fill="${light}" class="plant-stars"><path d="m69 101 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm159 42 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/><circle cx="86" cy="175" r="2"/><circle cx="204" cy="68" r="2"/></g>`:''}<path d="m101 250 14 40q35 10 70 0l14-40" fill="#414146"/><path d="m111 252 10 34q29 9 58 0l10-34" fill="#55515b"/><path d="M95 247q55-16 110 0v10q-55 13-110 0Z" fill="#73667a"/><ellipse cx="150" cy="247" rx="47" ry="6" fill="#232b2b"/><path d="m150 266 7 8-7 9-7-9Z" fill="none" stroke="#c1aa78"/><path d="m116 268 3 13m65-13-3 13" stroke="#948274"/></svg>`;
}
export function gardenScene(stage,species='moonveil') {
  return `<div class="garden-sun"></div><div class="scene-grid"></div><div class="scene-ground"></div><div class="scene-plant side left">${plantSVG(4,'starcap')}</div><div class="scene-plant center">${plantSVG(stage,species)}</div><div class="scene-plant side right">${plantSVG(4,'emberthorn')}</div><span class="garden-spark spark-one">✦</span><span class="garden-spark spark-two">✧</span><span class="plot-tag">protected by the old magic of Sepolia</span>`;
}
export function potionSVG(potion) {
  const color=potion.infusion.color;
  return `<svg class="potion-vial" viewBox="0 0 140 170" aria-hidden="true"><ellipse cx="70" cy="152" rx="45" ry="7" fill="${color}" opacity=".1"/><path d="M54 30v40C13 110 25 148 70 148s57-38 16-78V30" fill="${color}" fill-opacity=".07" stroke="${color}" stroke-opacity=".6" stroke-width="2"/><path d="M42 100c-24 32 2 43 28 43s51-11 28-43q-28 11-56 0" fill="${color}" fill-opacity=".6"/><ellipse cx="70" cy="101" rx="29" ry="7" fill="${color}" opacity=".9"/><rect x="51" y="29" width="38" height="10" rx="3" fill="#59556b" stroke="${color}" stroke-width="1"/><path d="M58 29V17h24v12" fill="#af9275"/><path d="M45 84q-15 24-10 34" fill="none" stroke="#fff" opacity=".25" stroke-width="3" stroke-linecap="round"/><circle class="bubble b1" cx="61" cy="123" r="3" fill="${color}"/><circle class="bubble b2" cx="80" cy="119" r="2" fill="${color}"/><path d="m70 108 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z" fill="#fff2d4"/><path d="m100 51 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="${color}"/></svg>`;
}
