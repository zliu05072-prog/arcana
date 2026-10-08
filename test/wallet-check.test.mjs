import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {inspectWallet,inspectPayment,recentPayments} from '../src/wallet-check.js';
const token='0x1111111111111111111111111111111111111111',wallet='0x2222222222222222222222222222222222222222',other='0x3333333333333333333333333333333333333333',hash='0x'+'a'.repeat(64);
const abi=new Interface(['function balanceOf(address) view returns(uint256)','event Transfer(address indexed from,address indexed to,uint256 value)']);
const encode=n=>abi.encodeFunctionResult('balanceOf',[n]);
const transfer=(value,address=token)=>({address,...abi.encodeEventLog(abi.getEvent('Transfer'),[token,wallet,value])});
const receipt={transactionHash:hash,status:'0x1',blockNumber:'0x64',gasUsed:'0x2',effectiveGasPrice:'0x3',logs:[transfer(40n)]};
function node({balance=180n,chain='0xaa36a7',accounts=[wallet],tx=receipt,logs=[]}={}){return async(method,params)=>{
 if(method==='eth_chainId')return chain;
 if(method==='eth_accounts')return accounts;
 if(method==='eth_getBlockByNumber')return{number:'0x64',timestamp:'0x64'};
 if(method==='eth_getBalance')return'0x12';
 if(method==='eth_call'){assert.equal(params[0].to,token);assert.equal(params[1],'0x64');return encode(balance);}
 if(method==='eth_getTransactionReceipt')return tx;
 if(method==='eth_getLogs')return logs;
 throw Error('Unexpected RPC method '+method);
};}
test('independent and wallet reads use the same explicit block and preserve integer precision',async()=>{
 const n=180n*10n**18n+1n;const a=await inspectWallet({request:node({balance:n}),walletRequest:node({balance:n}),token,wallet});assert.equal(a.balance,n);assert.equal(a.comparison,'matched');assert.equal(a.block,100);
});
test('wrong network/account, mismatched and unavailable wallet reads are distinguished',async()=>{
 for(const [options,expected]of[[{chain:'0x1'},'wrong-network'],[{accounts:[other]},'wrong-account'],[{balance:40n},'mismatch']]){const a=await inspectWallet({request:node(),walletRequest:node(options),token,wallet});assert.equal(a.comparison,expected);}
 const a=await inspectWallet({request:node(),walletRequest:async()=>{throw Error('Offline')},token,wallet});assert.equal(a.comparison,'unavailable');assert.equal(a.balance,180n);
});
test('wrong public network and a node behind the confirmation are not verified',async()=>{
 await assert.rejects(inspectWallet({request:node({chain:'0x1'}),token,wallet}),/not Sepolia/);
 await assert.rejects(inspectWallet({request:node(),token,wallet,minimumBlock:101}),/not reached/);
});
test('payment proof supports a receipt regardless of the outer transaction destination',async()=>{
 const p=await inspectPayment({request:node(),hash,token,wallet});assert.equal(p.proof.received,40n);assert.equal(p.networkFee,6n);
});
test('pending, reverted, unrelated-token and mismatched receipts never claim payment',async()=>{
 for(const tx of[null,{...receipt,status:'0x0'},{...receipt,transactionHash:'0x'+'b'.repeat(64)},{...receipt,logs:[transfer(40n,other)]}])await assert.rejects(inspectPayment({request:node({tx}),hash,token,wallet}));
});
test('recent payment recovery ignores removed logs and deduplicates transaction hashes',async()=>{
 const logs=[{transactionHash:hash},{transactionHash:hash},{transactionHash:'0x'+'b'.repeat(64),removed:true}];const p=await recentPayments({request:node({logs}),token,wallet,block:100});assert.equal(p.length,1);assert.equal(p[0].proof.received,40n);
});
