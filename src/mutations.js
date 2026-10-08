import {plantSVG, SPECIES} from './garden.js';
export const RARITIES = [
  {name:'Wildborn', label:'Common', chance:'75%', multiplier:1, color:'#a9c4ad'},
  {name:'Glimmer', label:'Uncommon', chance:'20%', multiplier:2, color:'#8ae3d4'},
  {name:'Prismatic', label:'Rare', chance:'4%', multiplier:5, color:'#bea4ff'},
  {name:'Celestial', label:'Legendary', chance:'1%', multiplier:12, color:'#f1cc82'}
];
export const MUTATIONS = [
  ['Moonveil Lily','Jadeglass Lily','Amethyst Eclipse','Crown of Selene'],
  ['Emberthorn Rose','Frostfire Rose','Dragonheart Rose','Phoenix Coronation'],
  ['Astral Starcap','Aurora Starcap','Nebula Cluster','Worldstar Mycelium']
];
export const BASE_REWARDS = [10,25,60,150];
export function rarityForRoll(roll) {
  if(!Number.isInteger(roll)||roll<0||roll>=10000) throw new Error('Invalid mutation roll');
  return roll<7500?0:roll<9500?1:roll<9900?2:3;
}
export function mutatedPlant(species,rarity,stage=4,infusion=0) {
  let svg=plantSVG(stage,SPECIES[species].id);
  if(stage<4) return svg;
  const palettes=[null,['#63d2b6','#d5fff2'],['#9b79e7','#efd5ff'],['#e4b864','#fff1c6']];
  if(rarity) {
    const originals=[['#b9a4ef','#ddd1fa'],['#ed9568','#f9ce8a'],['#74c9b5','#bdeee0']][species];
    originals.forEach((c,i)=>{svg=svg.replaceAll(c,palettes[rarity][i]);});
  }
  const marks = rarity===1?'<circle cx="150" cy="87" r="74" fill="none" stroke="currentColor" stroke-dasharray="2 12"/>':rarity===2?'<path d="m85 100 10-19 10 19-10 19Zm112 46 9-17 9 17-9 17ZM152 27l9-17 9 17-9 17Z" fill="currentColor" opacity=".8"/>':rarity===3?'<ellipse cx="150" cy="42" rx="76" ry="19" fill="none" stroke="currentColor" stroke-width="2"/><path d="m113 35-8-28 29 16 16-23 17 23 28-16-8 28Z" fill="currentColor" opacity=".8"/><circle cx="75" cy="167" r="4" fill="currentColor"/><circle cx="223" cy="95" r="4" fill="currentColor"/>':'';
  const seal=['☽','✦','❋'][infusion];
  return svg.replace('</svg>',`<g style="color:${RARITIES[rarity].color}">${marks}<text x="150" y="282" text-anchor="middle" font-size="14" fill="${RARITIES[rarity].color}">${seal}</text></g></svg>`);
}
