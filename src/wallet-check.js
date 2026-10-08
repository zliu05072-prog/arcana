import {Interface,getAddress} from 'ethers';
import {walletTransfer} from './receipt.js';
const tokenAbi=new Interface(['function balanceOf(address) view returns(uint256)','event Transfer(address indexed from,address indexed to,uint256 value)']);
export const SEPOLIA_ID=11155111n;
export async function publicRequest(method,params=[]){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch('https://ethereum-sepolia-rpc.publicnode.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:controller.signal});
    if(!response.ok)throw Error('The independent Sepolia connection is unavailable. Try again.');
    const body=await response.json();if(body.error)throw Error(body.error.message);return body.result;
  }finally{clearTimeout(timer);}
}
export async function inspectWallet({request=publicRequest,walletRequest,token,wallet,minimumBlock=0}){
  token=getAddress(token);wallet=getAddress(wallet);
  if(BigInt(await request('eth_chainId',[]))!==SEPOLIA_ID)throw Error('The read connection is not Sepolia.');
  const latest=await request('eth_getBlockByNumber',['latest',false]);
  const block=Number(BigInt(latest.number));if(block<minimumBlock)throw Error('This node has not reached your confirmed transaction yet. Refresh shortly.');
  const params=[{to:token,data:tokenAbi.encodeFunctionData('balanceOf',[wallet])},latest.number];
  const [raw,native]=await Promise.all([request('eth_call',params),request('eth_getBalance',[wallet,latest.number])]);
  const balance=tokenAbi.decodeFunctionResult('balanceOf',raw)[0];let walletBalance=null,comparison='unavailable';
  if(walletRequest){try{
    const [chain,accounts]=await Promise.all([walletRequest('eth_chainId',[]),walletRequest('eth_accounts',[])]);
    if(BigInt(chain)!==SEPOLIA_ID)comparison='wrong-network';
    else if(!accounts[0]||accounts[0].toLowerCase()!==wallet.toLowerCase())comparison='wrong-account';
    else{walletBalance=tokenAbi.decodeFunctionResult('balanceOf',await walletRequest('eth_call',params))[0];comparison=walletBalance===balance?'matched':'mismatch';}
  }catch{comparison='unavailable';}}
  return {token,wallet,block,blockTime:Number(BigInt(latest.timestamp))*1000,balance,eth:BigInt(native),walletBalance,comparison};
}
export async function inspectPayment({request=publicRequest,hash,token,wallet}){
  if(!/^0x[\da-f]{64}$/i.test(hash))throw Error('Paste a full transaction hash: 0x followed by 64 characters.');
  if(BigInt(await request('eth_chainId',[]))!==SEPOLIA_ID)throw Error('The read connection is not Sepolia.');
  const receipt=await request('eth_getTransactionReceipt',[hash]);
  if(!receipt)throw Error('No confirmed receipt found on Sepolia yet. Check the hash or try again shortly.');
  if(receipt.transactionHash.toLowerCase()!==hash.toLowerCase())throw Error('The returned receipt does not match this transaction.');
  if(Number(receipt.status)!==1)throw Error('This transaction reverted. It did not pay ARCA.');
  const proof=walletTransfer(receipt,token,wallet);
  if(proof.received===0n&&proof.sent===0n)throw Error('This receipt has no current ARCA transfer for this wallet. Check the recipient and token contract.');
  return {hash:receipt.transactionHash,blockNumber:Number(BigInt(receipt.blockNumber)),proof,networkFee:BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice||0)};
}
export async function recentPayments({request=publicRequest,token,wallet,block}){
  const topics=tokenAbi.encodeFilterTopics('Transfer',[null,getAddress(wallet)]);
  const logs=await request('eth_getLogs',[{address:getAddress(token),fromBlock:'0x'+Math.max(0,block-2000).toString(16),toBlock:'0x'+block.toString(16),topics}]);
  const hashes=[...new Set(logs.filter(l=>!l.removed).reverse().map(l=>l.transactionHash))].slice(0,5);
  return Promise.all(hashes.map(hash=>inspectPayment({request,hash,token,wallet})));
}
