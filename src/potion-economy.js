// One shared definition for the server draw, price and public odds.
export const ECONOMY_VERSION = 2;
export const SALE_PRICES = [40, 60, 150, 400];
export const GAME_POTIONS = [
  {name:'Whisperdew Tonic',price:60,tier:'I · BASIC',recipe:'Dew of first light',odds:[75,20,4,1]},
  {name:'Moonwell Draught',price:120,tier:'II · ENHANCED',recipe:'Moonlight for a rarer bloom',odds:[70,20,9,1]},
  {name:'Starfire Elixir',price:180,tier:'III · RARE SEEKER',recipe:'A little more starlit possibility',odds:[67,20,12,1]}
];
export function drawRarity(roll,tier=0){
  if(!Number.isInteger(roll)||roll<0||roll>=10000)throw Error('Invalid random draw');
  if(!Number.isInteger(tier)||!GAME_POTIONS[tier])throw Error('Choose a valid potion.');
  let upper=0;for(let i=0;i<4;i++){upper+=GAME_POTIONS[tier].odds[i]*100;if(roll<upper)return i;}
}
