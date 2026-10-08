import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GAME_POTIONS,drawRarity} from '../src/potion-economy.js';
import {emptyLedger,emptyAccount,change,UNIT,assertBacked,flowerReward} from '../server/ledger.js';
test('all 10,000 draws match each tier odds; price and draw inputs reject removed tiers',()=>{
  assert.deepEqual(GAME_POTIONS.map(p=>p.price),[60,120,180]);
  for(let tier=0;tier<3;tier++){const counts=[0,0,0,0];for(let r=0;r<10000;r++)counts[drawRarity(r,tier)]++;assert.deepEqual(counts,GAME_POTIONS[tier].odds.map(p=>p*100));}
  for(const r of [-1,10000,1.5])assert.throws(()=>drawRarity(r,0));assert.throws(()=>drawRarity(0,3));
});
test('500 ARCA reserve supports every new potion; rare and legendary payouts stay backed',()=>{
  for(let tier=0;tier<3;tier++)for(const [roll,reward] of [[9850,150],[9999,400]]){
    const l={...emptyLedger(),vault:'vault',backing:String(500n*UNIT)},a=emptyAccount();
    change(l,a,{kind:'deposit',amount:String(180n*UNIT)},0);
    change(l,a,{kind:'grow',id:'f',species:4,tier,infusion:2,roll},0);
    assert.equal(a.balance,String(BigInt(180-GAME_POTIONS[tier].price)*UNIT));
    assert.equal(l.reserved,String(400n*UNIT));assert.equal(l.fees,String(BigInt(GAME_POTIONS[tier].price/10)*UNIT));
    change(l,a,{kind:'sell',id:'f'},9000);assert.equal(a.balance,String(BigInt(180-GAME_POTIONS[tier].price+reward)*UNIT));assert.equal(l.reserved,'0');assertBacked(l);
  }
});
test('legacy tier-three flower retains its original 3,200 ARCA legendary offer and reserve',()=>{
  const l={...emptyLedger(),vault:'vault',backing:String(4000n*UNIT),reserved:String(3200n*UNIT)},a=emptyAccount();
  a.flowers.push({id:'old',species:0,tier:3,infusion:0,rarity:3,readyAt:0,sold:false});assert.equal(flowerReward(a.flowers[0]),3200n*UNIT);
  change(l,a,{kind:'sell',id:'old'},1);assert.equal(a.balance,String(3200n*UNIT));assert.equal(l.reserved,'0');assertBacked(l);
  assert.throws(()=>change(l,a,{kind:'grow',id:'removed',species:0,tier:3,infusion:0,roll:0}),/valid seed and potion/);
});
