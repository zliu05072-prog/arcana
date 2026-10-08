import {plantSVG, INFUSIONS, potionSVG} from './garden.js';
export {INFUSIONS, potionSVG};
import {RARITIES as ART_RARITIES} from './mutations.js';
export {rarityForRoll} from './mutations.js';
export const RARITIES=ART_RARITIES.map((r,i)=>({...r,multiplier:[1,1.5,3.75,10][i]}));
export const INITIAL_RESERVE=1000000n*10n**18n;
export const rewardAmount=(tier,rarity)=>BigInt([40,60,150,400][rarity]*(2**tier))*10n**18n;
export const SEEDS = [
  {id:'moonveil',name:'Moonveil Lily',note:'A silver crescent sleeps inside this seed.',color:'#bea4eb'},
  {id:'emberthorn',name:'Emberthorn Rose',note:'A little dragon fire, waiting to awaken.',color:'#efa37e'},
  {id:'starcap',name:'Astral Starcap',note:'A spore from the far side of a dream.',color:'#a4d3b7'},
  {id:'crystalbell',name:'Crystal Bellflower',note:'Listen closely. The frost is singing.',color:'#abcafa'},
  {id:'sunwhisper',name:'Sunwhisper Sunflower',note:'Plant a small piece of the morning sun.',color:'#edcd76'}
];
export const FORMS = [
  ['Moonveil Lily','Jadeglass Lily','Amethyst Eclipse','Crown of Selene'],
  ['Emberthorn Rose','Frostfire Rose','Dragonheart Rose','Phoenix Coronation'],
  ['Astral Starcap','Aurora Starcap','Nebula Cluster','Worldstar Mycelium'],
  ['Crystal Bellflower','Peachbell Blossom','Crystal Chime','Frostlight Cathedral'],
  ['Sunwhisper Sunflower','Lavender Sunflower','Clockwork Sun','Dawn Sovereign']
];
export const POTIONS = [
  {name:'Whisperdew Tonic',price:60,base:40,tier:'I · APPRENTICE',recipe:'Dew of first light'},
  {name:'Moonwell Draught',price:120,base:80,tier:'II · ADEPT',recipe:'Water from a hidden moonwell'},
  {name:'Starfire Elixir',price:240,base:160,tier:'III · ENCHANTER',recipe:'Essence of a wandering star'},
  {name:'Phoenix Nectar',price:480,base:320,tier:'IV · MASTER',recipe:'A phoenix’s first golden tear'}
];
export const inventoryKey=(tier,infusion)=>tier*3+infusion;
export const potion=(tier,infusion)=>({...POTIONS[tier],infusion:INFUSIONS[infusion]});
// Viewports display the approved artwork unchanged; original PNGs remain intact.
// Coordinates use a normalized 1984 x 794 canvas regardless of native resolution.
const columns=[[24,344],[405,758],[790,1145],[1180,1514],[1550,1970]];
export function specimen(species,rarity=0,seed=false){
  const [x,end]=seed?columns[0]:columns[rarity+1];
  const y=seed?320:200,h=seed?330:545;
  return `<svg class="botanical-art ${seed?'seed-art':'bloom-art'}" viewBox="${x} ${y} ${end-x} ${h}" aria-hidden="true" overflow="hidden"><svg x="${x}" y="${y}" width="${end-x}" height="${h}" overflow="hidden"><image x="${-x}" y="${-y}" href="/art/${SEEDS[species].id}-sheet.png" width="1984" height="794" preserveAspectRatio="none"/></svg></svg>`;
}
export function growingArt(species,phase,infusion){
  return `<div class="growth-art phase-${phase}" style="--magic:${INFUSIONS[infusion].color}"><div class="growth-earth"></div><div class="growth-seed">${specimen(species,0,true)}</div><div class="growth-shoot">${plantSVG(phase===1?1:3,species%3)}</div><div class="pour-vial">${potionSVG(potion(0,infusion))}</div><span class="magic-drop d1"></span><span class="magic-drop d2"></span><span class="magic-drop d3"></span><span class="growth-spark">✦</span></div>`;
}

// Fixed testnet exchange: native Sepolia ETH -> ARCA, using integer wei only.
export const ARCA_PER_ETH=100000n;
export const MIN_EXCHANGE_WEI=100000000000000n;
export const MAX_EXCHANGE_WEI=100000000000000000n;
export function quoteArca(wei){
  if(typeof wei!=='bigint'||wei<MIN_EXCHANGE_WEI||wei>MAX_EXCHANGE_WEI)throw new Error('Enter 0.0001 to 0.1 Sepolia ETH.');
  return wei*ARCA_PER_ETH;
}
