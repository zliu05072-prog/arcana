import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, parseEther } from 'ethers';
import { readFileSync } from 'node:fs';
import '../scripts/compile.mjs';
const artifact = JSON.parse(readFileSync(new URL('../src/contract.json', import.meta.url)));
let rpc, provider, creator, backer, other, contract;
before(async () => {
  rpc = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, wallet: { totalAccounts: 4 } });
  provider = new BrowserProvider(rpc); provider.pollingInterval = 10;
  [creator,backer,other] = await Promise.all([0,1,2].map(i=>provider.getSigner(i)));
});
after(async()=>{ await provider.destroy(); await rpc.disconnect(); });
async function fresh() { contract = await new ContractFactory(artifact.abi,artifact.bytecode,creator).deploy(); await contract.waitForDeployment(); }
async function create(goal='0.002',duration=60) { await (await contract.createCampaign('Campus garden','Tools and seeds',parseEther(goal),duration)).wait(); }
test('creation persists campaign metadata and emits an event', async()=> {
  await fresh(); await create(); const c=await contract.getCampaign(0);
  assert.equal(c.creator,await creator.getAddress()); assert.equal(c.title,'Campus garden'); assert.equal(c.goal,parseEther('0.002')); assert.equal(await contract.campaignCount(),1n);
  const events=await contract.queryFilter(contract.filters.CampaignCreated());assert.equal(events.length,1);
});
test('rejects invalid metadata, duration, goal and campaign ID',async()=>{
  await fresh();
  for(const args of [['','',1,1],['x'.repeat(81),'',1,1],['x','y'.repeat(501),1,1],['x','',0,1],['x','',1,0],['x','',1,43201]])await assert.rejects(contract.createCampaign.staticCall(...args));
  await assert.rejects(contract.getCampaign(0)); await assert.rejects(contract.fund.staticCall(99,{value:1}));
});
test('counts unique backers, accumulates contributions and rejects excess funding',async()=>{
  await fresh();await create();
  await (await contract.connect(backer).fund(0,{value:parseEther('0.0004')})).wait();
  await (await contract.connect(backer).fund(0,{value:parseEther('0.0006')})).wait();
  assert.equal((await contract.getCampaign(0)).backers,1n);assert.equal(await contract.contributions(0,await backer.getAddress()),parseEther('0.001'));
  await assert.rejects(contract.fund.staticCall(0,{value:0}));await assert.rejects(contract.fund.staticCall(0,{value:parseEther('0.0011')}));
  await (await contract.connect(other).fund(0,{value:parseEther('0.001')})).wait();
  assert.equal((await contract.getCampaign(0)).backers,2n);await assert.rejects(contract.fund.staticCall(0,{value:1}));
});
test('only creator withdraws successful campaign, exactly once',async()=>{
  await fresh();await create();await assert.rejects(contract.withdraw.staticCall(0));
  await (await contract.connect(backer).fund(0,{value:parseEther('0.002')})).wait();
  await assert.rejects(contract.connect(backer).withdraw.staticCall(0));
  await (await contract.withdraw(0)).wait();assert.equal((await contract.getCampaign(0)).withdrawn,true);
  assert.equal(BigInt(await rpc.request({method:'eth_getBalance',params:[await contract.getAddress(),'latest']})),0n);
  await assert.rejects(contract.withdraw.staticCall(0));await assert.rejects(contract.connect(backer).refund.staticCall(0));
});
test('failed campaign refunds each backer once and keeps historical raised amount',async()=>{
  await fresh();await create('0.01',1);
  await (await contract.connect(backer).fund(0,{value:parseEther('0.001')})).wait();
  await (await contract.connect(other).fund(0,{value:parseEther('0.002')})).wait();
  await assert.rejects(contract.connect(backer).refund.staticCall(0));
  await rpc.request({method:'evm_increaseTime',params:[61]});await rpc.request({method:'evm_mine',params:[]});
  await assert.rejects(contract.fund.staticCall(0,{value:1}));
  await (await contract.connect(backer).refund(0)).wait();
  assert.equal(await contract.contributions(0,await backer.getAddress()),0n);
  await assert.rejects(contract.connect(backer).refund.staticCall(0));await assert.rejects(contract.refund.staticCall(0));
  await (await contract.connect(other).refund(0)).wait();
  assert.equal((await contract.getCampaign(0)).raised,parseEther('0.003'));
  assert.equal(BigInt(await rpc.request({method:'eth_getBalance',params:[await contract.getAddress(),'latest']})),0n);
});
test('campaign balances stay isolated through payouts and refunds',async()=>{
  await fresh();await create('0.001',1);await create('0.003',1);
  await (await contract.connect(backer).fund(0,{value:parseEther('0.001')})).wait();
  await (await contract.connect(other).fund(1,{value:parseEther('0.002')})).wait();
  await (await contract.withdraw(0)).wait();
  assert.equal(BigInt(await rpc.request({method:'eth_getBalance',params:[await contract.getAddress(),'latest']})),parseEther('0.002'));
  await rpc.request({method:'evm_increaseTime',params:[61]});await rpc.request({method:'evm_mine',params:[]});
  await assert.rejects(contract.connect(backer).refund.staticCall(0));await (await contract.connect(other).refund(1)).wait();
  assert.equal(BigInt(await rpc.request({method:'eth_getBalance',params:[await contract.getAddress(),'latest']})),0n);
});
