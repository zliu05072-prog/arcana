import {verifyMessage,keccak256,toUtf8Bytes} from 'ethers';
import {database,readLedger,readAccount,transact,positive,flowerReward} from './ledger.js';
import {TOKEN,OPERATOR,CHAIN,authorizer,claimTypes,domain,rpc,receipt,call,tokenInterface,vaultInterface,events,depositAmount,verifySetup,paidReceipt,deploymentQuote} from './chain.js';

const PAGES_ORIGIN='https://zliu05072-prog.github.io';
const isPages=request=>request.headers.get('origin')===PAGES_ORIGIN;
const loginOrigin=request=>isPages(request)?PAGES_ORIGIN:new URL(request.url).origin;
const sessionKey=(request,raw)=>hash((isPages(request)?'pages:':'')+raw);
const hexRandom=(n=32)=>'0x'+Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
const hash=s=>keccak256(toUtf8Bytes(s));
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const walletAddress=s=>{if(typeof s!=='string'||!/^0x[\da-f]{40}$/i.test(s))throw Error('Invalid wallet address.');return s.toLowerCase();};
function randomRoll(){let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=4294960000);return n%10000;}
async function limited(db,key,max,now=Date.now()) {
  const window=Math.floor(now/600000),id=`${key}:${window}`;
  const row=await db.prepare('INSERT INTO limits (id,count,expires) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(id,(window+1)*600000).first();
  if(row.count>max)throw Error('Too many requests. Please wait a few minutes.');
}
async function session(db,request) {
  const raw=isPages(request)?request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]:request.headers.get('cookie')?.match(/(?:^|;\s*)arcana_session=([a-f0-9]{64})/)?.[1];
  if(!raw)return null;
  const row=await db.prepare('SELECT wallet FROM sessions WHERE hash = ? AND expires > ?').bind(sessionKey(request,raw),Date.now()).first();return row?.wallet||null;
}
function cookie(request,token,age) {return `arcana_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
async function auth(db,request){const wallet=await session(db,request);if(!wallet){const e=Error('Sign in once with your wallet to open your saved garden. No gas is charged.');e.status=401;throw e;}return wallet;}
function publicAccount(a) {return {...a,flowers:a.flowers.map(f=>Date.now()<f.readyAt?{...f,rarity:null}:{...f,reward:flowerReward(f).toString()})};}
async function route(request,env) {
  const url=new URL(request.url),path=url.pathname,db=database(env);
  if(request.method==='GET'&&path==='/api/state') {
    const [wallet,l]=await Promise.all([session(db,request),readLedger(db)]);
    return json({wallet,account:wallet?publicAccount(await readAccount(db,wallet)):null,vault:l.value.vault,token:TOKEN,chainId:CHAIN,operator:OPERATOR,signer:env.ARCA_SIGNER_KEY?authorizer(env).address:null,reserve:{free:(BigInt(l.value.backing)-BigInt(l.value.credits)-BigInt(l.value.pending)-BigInt(l.value.reserved)-BigInt(l.value.fees)).toString(),fees:l.value.fees},serverTime:Date.now()});
  }
  if(request.method!=='POST')return json({error:'Not found'},404);
  if(request.headers.get('origin')!==url.origin&&!isPages(request)) return json({error:'Open this action from the Arcana website.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
  const text=await request.text();if(text.length>8192)return json({error:'Request too large'},413);const body=JSON.parse(text);
  if(path==='/api/auth/challenge') {
    const wallet=walletAddress(body.wallet);await limited(db,`login:${wallet}`,20);await limited(db,`ip:${hash(request.headers.get('cf-connecting-ip')||'unknown')}`,100);
    const id=hexRandom(24),expires=Date.now()+300000;
    const origin=loginOrigin(request);
    const message=`${new URL(origin).host} wants you to sign in to Arcana.\n\nWallet: ${wallet}\nNetwork: Ethereum Sepolia (${CHAIN})\nURI: ${origin}\nNonce: ${id}\nExpires: ${new Date(expires).toISOString()}\n\nOpen your saved garden. This signature does not transfer tokens, approve spending, or cost gas.`;
    await db.batch([db.prepare('DELETE FROM challenges WHERE expires < ?').bind(Date.now()),db.prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()),db.prepare('DELETE FROM limits WHERE expires < ?').bind(Date.now()),db.prepare('INSERT INTO challenges (id,wallet,message,expires) VALUES (?,?,?,?)').bind(id,wallet,message,expires)]);
    return json({id,message});
  }
  if(path==='/api/auth/verify') {
    if(typeof body.id!=='string'||typeof body.signature!=='string')throw Error('Invalid login proof.');
    const c=await db.prepare('SELECT * FROM challenges WHERE id = ? AND expires > ?').bind(body.id,Date.now()).first();
    if(!c||!c.message.includes(`\nURI: ${loginOrigin(request)}\n`)||verifyMessage(c.message,body.signature).toLowerCase()!==c.wallet)throw Error('Wallet login signature is invalid or expired.');
    const deleted=await db.prepare('DELETE FROM challenges WHERE id = ? RETURNING id').bind(body.id).first();if(!deleted)throw Error('Login request already used.');
    const token=hexRandom().slice(2);await db.prepare('INSERT INTO sessions (hash,wallet,expires) VALUES (?,?,?)').bind(sessionKey(request,token),c.wallet,Date.now()+(isPages(request)?8*3600000:7*86400000)).run();
    return isPages(request)?json({wallet:c.wallet,sessionToken:token}):json({wallet:c.wallet},200,{'set-cookie':cookie(request,token,7*86400)});
  }
  if(path==='/api/auth/logout')return json({ok:true},200,{'set-cookie':cookie(request,'',0)});
  const wallet=await auth(db,request);await limited(db,`actions:${wallet}`,300);
  const l=(await readLedger(db)).value;
  const execute=(id,event)=>transact(db,{wallet,id,fingerprint:hash(JSON.stringify({wallet,event})),event});
  if(path==='/api/setup/quote') {
    if(wallet!==OPERATOR)throw Error('Operator only.');
    return json(await deploymentQuote(env,positive(body.amount)));
  }
  if(path==='/api/setup') {
    if(wallet!==OPERATOR)throw Error('Only the existing garden operator can activate settlement.');
    const address=walletAddress(body.address),proof=await verifySetup(env,address,body.hash);
    return json(await execute('setup:'+address,{kind:'setup',vault:address,amount:proof.amount}));
  }
  if(path==='/api/wallet')return json({balance:(await call(env,TOKEN,tokenInterface,'balanceOf',[wallet])).toString(),token:TOKEN,wallet});
  if(!l.vault)throw Error('The new settlement vault is awaiting activation. Existing wallet ARCA is unchanged.');
  if(path==='/api/deposit') {
    const r=await receipt(env,body.hash),amount=depositAmount(r,l.vault,wallet);
    return json(await execute('deposit:'+body.hash.toLowerCase(),{kind:'deposit',amount,hash:body.hash.toLowerCase()}));
  }
  if(path==='/api/reserve') {
    if(wallet!==OPERATOR)throw Error('Operator only.');const r=await receipt(env,body.hash);
    if(r.contractAddress?.toLowerCase()===l.vault)throw Error('Deployment reserves are already registered.');
    const amount=events(r,l.vault,vaultInterface,'ReserveFunded').reduce((n,e)=>n+e.amount,0n).toString();
    return json(await execute('reserve:'+body.hash.toLowerCase(),{kind:'reserve',amount}));
  }
  if(path==='/api/grow'||path==='/api/sell'||path==='/api/withdraw') {
    if(typeof body.requestId!=='string'||!/^[-\da-z]{16,80}$/i.test(body.requestId))throw Error('A unique request ID is required.');
    const id=wallet+':'+body.requestId;
    // The public request fingerprint excludes server randomness/time. Replays
    // return the first durable result and cannot generate a different mutation.
    const fingerprint=hash(JSON.stringify({path,wallet,...body}));
    const prior=await db.prepare('SELECT fingerprint,result FROM operations WHERE id = ?').bind(id).first();
    if(prior){if(prior.fingerprint!==fingerprint)throw Error('Request ID conflict.');return json(JSON.parse(prior.result));}
    let event;
    if(path==='/api/grow'&&body.economyVersion!==2)throw Object.assign(Error('Potion prices have changed. Refresh the page before planting; no ARCA was spent.'),{unchanged:true});
    if(path==='/api/grow')event={kind:'grow',id:hexRandom(16),species:body.species,tier:body.tier,infusion:body.infusion,roll:randomRoll()};
    if(path==='/api/sell')event={kind:'sell',id:body.id};
    if(path==='/api/withdraw'){positive(body.amount);authorizer(env);event={kind:'withdraw',amount:body.amount,nonce:hexRandom(),deadline:Math.floor(Date.now()/1000)+600};}
    return json(await transact(db,{id,fingerprint,wallet,event}));
  }
  if(path==='/api/withdraw/voucher'||path==='/api/withdraw/reconcile') {
    const a=await readAccount(db,wallet),w=a.withdrawals.find(w=>w.nonce===body.nonce);if(!w)throw Error('Withdrawal not found.');
    if(w.status!=='pending')return json(w);
    if(path.endsWith('/voucher')) {
      if(w.deadline<Math.floor(Date.now()/1000))throw Error('This voucher expired. Use Recover pending withdrawal.');
      const signature=await authorizer(env).signTypedData(domain(l.vault),claimTypes,{wallet,amount:w.amount,nonce:w.nonce,deadline:w.deadline});return json({...w,signature});
    }
    if(body.hash) {
      const proof=await paidReceipt(env,l.vault,wallet,w,body.hash);
      return json(await execute('paid:'+w.nonce,{kind:'paid',nonce:w.nonce,hash:proof.hash}));
    }
    // Never release an issued voucher on wallet rejection alone. Cached signed
    // claims stay spendable until expiry; require an unused nonce at FINALITY.
    const finalized=await rpc(env,'eth_getBlockByNumber',['finalized',false]);
    const used=await call(env,l.vault,vaultInterface,'used',[w.nonce],finalized.number);
    if(used)throw Error('This withdrawal was paid. Paste its transaction hash to complete the receipt check.');
    if(Number(finalized.timestamp)<=w.deadline)throw Error('The withdrawal is still reserved. Retry payment, or recover it after the 10-minute voucher and Sepolia finality have passed.');
    return json(await execute('expired:'+w.nonce,{kind:'expired',nonce:w.nonce}));
  }
  return json({error:'Not found'},404);
}
export default {async fetch(request,env) {
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin&&!isPages(request))return json({error:'This origin is not allowed.'},403);
  const cors=isPages(request)?{'access-control-allow-origin':PAGES_ORIGIN,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','vary':'Origin'}:{};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  let response;try{response=await route(request,env);}catch(e){console.error('Arcana API:',path,e.message);response=json({error:e.message||'The garden is temporarily unavailable.',unchanged:e.unchanged===true},e.status||400);}
  for(const [key,value] of Object.entries(cors))response.headers.set(key,value);
  return response;
}};
