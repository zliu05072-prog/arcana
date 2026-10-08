import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {walletTransfer} from '../src/receipt.js';
const token='0x1111111111111111111111111111111111111111', wallet='0x2222222222222222222222222222222222222222',other='0x3333333333333333333333333333333333333333';
const abi=new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
function transfer(from,to,value,address=token){return {address,...abi.encodeEventLog(abi.getEvent('Transfer'),[from,to,value])};}
test('receipt proves only this token and wallet, excluding unrelated and malformed events',()=>{
 const logs=[transfer(token,wallet,40n),transfer(wallet,token,60n),transfer(token,other,900n),transfer(token,wallet,1000n,other),{address:token,topics:[],data:'0x'}];
 assert.deepEqual(walletTransfer({status:1,logs},token,wallet),{received:40n,sent:60n,net:-20n});
});
test('unconfirmed and reverted transactions never count as wallet payments',()=>{
 for(const status of [undefined,0,'0x0'])assert.deepEqual(walletTransfer({status,logs:[transfer(token,wallet,40n)]},token,wallet),{received:0n,sent:0n,net:0n});
 assert.deepEqual(walletTransfer({status:'0x1',logs:[transfer(token,wallet,40n)]},token,wallet),{received:40n,sent:0n,net:40n});
});
