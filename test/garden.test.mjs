import {test} from 'node:test';
import assert from 'node:assert/strict';
import {growth, potionFor, speciesFor, encodeStory} from '../src/garden.js';
test('plant stages reflect exact on-chain progress and reach bloom only at the goal',()=>{
  for(const [amount, stage] of [[0n,0],[1n,1],[2499n,1],[2500n,2],[7499n,2],[7500n,3],[9999n,3],[10000n,4]]) {
    assert.equal(growth(amount,10000n).stage,stage);
  }
  assert.equal(growth(10000n,10000n).percent,100);
  assert.equal(growth(9999n,10000n).percent,99.99);
});
test('potion tiers respect exact wei boundaries rather than rounded ETH values',()=>{
  for(const [wei,rank] of [[1n,0],[499999999999999n,0],[500000000000000n,1],[999999999999999n,1],[1000000000000000n,2],[1999999999999999n,2],[2000000000000000n,3]]) {
    assert.equal(potionFor(wei).rank,rank);
  }
  assert.throws(()=>potionFor(0n));
  assert.throws(()=>potionFor(-1n));
});
test('cosmetic infusions do not alter potion rank or contribution-driven growth',()=>{
  for(const infusion of ['moon','ember','dream']) {
    assert.equal(potionFor(1000000000000000n,infusion).name,'Starfire Elixir');
    assert.equal(potionFor(1000000000000000n,infusion).infusion.id,infusion);
  }
  assert.equal(growth(1000000000000000n,5000000000000000n).percent,20);
});
test('species tags survive story round trips and legacy stories stay intact',()=>{
  const story='A sanctuary for midnight readers.\nEveryone is welcome.';
  const decoded=speciesFor(encodeStory('starcap',story));
  assert.equal(decoded.species.name,'Astral Starcap');
  assert.equal(decoded.story,story);
  assert.equal(speciesFor(story,1).story,story);
  assert.equal(speciesFor(story,1).species.id,'emberthorn');
  assert.throws(()=>encodeStory('unknown',story));
});
