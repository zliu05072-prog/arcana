import {Interface, keccak256, Wallet} from 'ethers';
import artifact from '../src/vault-contract.json' with {type:'json'};
export const TOKEN='0xc353a90e666e2c70279dc692feee7cb15aa8cb83';
export const OPERATOR='0x962189caf0c97bd530611818b96dc54242428a33';
export const CHAIN=11155111;
export const vaultInterface=new Interface(artifact.abi);
export const tokenInterface=new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)','function balanceOf(address) view returns(uint256)']);
export const claimTypes={Claim:[{name:'wallet',type:'address'},{name:'amount',type:'uint256'},{name:'nonce',type:'bytes32'},{name:'deadline',type:'uint256'}]};
export const domain=vault=>({name:'ArcanaVault',version:'1',chainId:CHAIN,verifyingContract:vault});
export function authorizer(env){if(!env.ARCA_SIGNER_KEY)throw Error('Settlement signing is not configured.');return new Wallet(env.ARCA_SIGNER_KEY);}
export async function rpc(env,method,params=[]) {
  const urls=env.SEPOLIA_RPC_URL?[env.SEPOLIA_RPC_URL]:['https://ethereum-sepolia-rpc.publicnode.com','https://sepolia.drpc.org'];
  for(const url of urls)try {
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000)});
    if(!r.ok)continue;const data=await r.json();if(data.error)continue;return data.result;
  }catch{}
  throw Error('Sepolia is temporarily unavailable. Your saved game balance is unchanged.');
}
export async function call(env,address,iface,name,args=[],tag='latest') {
  return iface.decodeFunctionResult(name,await rpc(env,'eth_call',[{to:address,data:iface.encodeFunctionData(name,args)},tag]))[0];
}
export async function receipt(env,hash) {
  if(!/^0x[\da-f]{64}$/i.test(hash))throw Error('Enter a valid transaction hash.');
  const [r,head]=await Promise.all([rpc(env,'eth_getTransactionReceipt',[hash]),rpc(env,'eth_blockNumber')]);
  if(!r)throw Error('Transaction is still pending. Retry verification after it confirms.');
  if(r.status!=='0x1')throw Error('Transaction failed on Sepolia. No deposit or payout was credited.');
  if(BigInt(head)-BigInt(r.blockNumber)<1n)throw Error('Waiting for a second Sepolia confirmation. Retry verification shortly.');
  return r;
}
export function events(r,address,iface,name) {
  return r.logs.filter(l=>l.address.toLowerCase()===address.toLowerCase()).flatMap(l=>{try{const p=iface.parseLog(l);return p?.name===name?[p.args]:[];}catch{return [];}});
}
export function depositAmount(r,vault,wallet) {
  const transfers=events(r,TOKEN,tokenInterface,'Transfer').filter(e=>e.from.toLowerCase()===wallet&&e.to.toLowerCase()===vault);
  const deposits=events(r,vault,vaultInterface,'EthDeposited').filter(e=>e.wallet.toLowerCase()===wallet);
  const amount=transfers.reduce((n,e)=>n+e.value,0n)+deposits.reduce((n,e)=>n+e.amount,0n);
  if(amount<=0n)throw Error('This receipt has no ARCA deposit from your wallet into this game vault.');return amount.toString();
}
export async function verifySetup(env,address,hash) {
  if(!/^0x[\da-f]{40}$/i.test(address))throw Error('Invalid settlement address.');
  const r=await receipt(env,hash),code=await rpc(env,'eth_getCode',[address,'latest']);
  if(keccak256(code)!==keccak256(artifact.deployedBytecode))throw Error('This is not the reviewed ArcanaVault contract.');
  const [token,signer,operator]=await Promise.all(['token','authorizer','operator'].map(n=>call(env,address,vaultInterface,n)));
  if(token.toLowerCase()!==TOKEN||signer.toLowerCase()!==authorizer(env).address.toLowerCase()||operator.toLowerCase()!==OPERATOR)throw Error('Settlement configuration does not match this game.');
  // Only the creation receipt may seed the ledger. Later reserve funding has its own path.
  if(r.contractAddress?.toLowerCase()!==address)throw Error('Provide this vault’s deployment transaction.');
  const amount=events(r,address,vaultInterface,'ReserveFunded').reduce((n,e)=>n+e.amount,0n).toString();
  return {amount,block:Number(r.blockNumber)};
}
export async function paidReceipt(env,vault,wallet,w,hash) {
  const r=await receipt(env,hash);
  const paid=events(r,vault,vaultInterface,'Withdrawn').some(e=>e.wallet.toLowerCase()===wallet&&e.nonce===w.nonce&&e.amount===BigInt(w.amount));
  const sent=events(r,TOKEN,tokenInterface,'Transfer').some(e=>e.from.toLowerCase()===vault&&e.to.toLowerCase()===wallet&&e.value===BigInt(w.amount));
  if(!paid||!sent)throw Error('This transaction does not prove this withdrawal was paid to your wallet.');
  return {hash,block:Number(r.blockNumber)};
}
