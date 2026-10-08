// Money is always integer token wei, serialized as decimal strings. No floats.
export const UNIT = 10n ** 18n;
export const emptyLedger = () => ({vault:null,backing:'0',credits:'0',pending:'0',reserved:'0',fees:'0'});
export const emptyAccount = () => ({balance:'0',flowers:[],withdrawals:[],history:[]});
export const costOf = tier => BigInt(60 * 2 ** tier) * UNIT;
export const rewardOf = (tier, rarity) => BigInt([40,60,150,400][rarity] * 2 ** tier) * UNIT;
export function rarityOf(roll) { if(!Number.isInteger(roll)||roll<0||roll>=10000)throw Error('Invalid random draw'); return roll<7500?0:roll<9500?1:roll<9900?2:3; }
export function positive(value) { if(typeof value!=='string'||!/^\d{1,40}$/.test(value)||BigInt(value)<=0n)throw Error('Enter a positive ARCA amount.'); return BigInt(value); }
const add=(o,key,value)=>o[key]=(BigInt(o[key])+value).toString();
export function assertBacked(l) {
  for(const key of ['backing','credits','pending','reserved','fees'])if(BigInt(l[key])<0n)throw Error('Ledger invariant failed.');
  if(BigInt(l.backing)<BigInt(l.credits)+BigInt(l.pending)+BigInt(l.reserved)+BigInt(l.fees))throw Error('Pip needs more buyback reserves. Choose a smaller potion or try later. Your balance was not spent.');
}
export function change(l,a,event,now=Date.now()) {
  const e=event, at=now;
  let result={kind:e.kind,at};
  if(e.kind==='deposit') { const n=positive(e.amount);add(l,'backing',n);add(l,'credits',n);add(a,'balance',n);result={...result,amount:e.amount,hash:e.hash}; }
  else if(e.kind==='reserve') { add(l,'backing',positive(e.amount));result.amount=e.amount; }
  else if(e.kind==='setup') { if(l.vault)throw Error('Settlement vault already registered.');l.vault=e.vault;add(l,'backing',BigInt(e.amount));result.vault=e.vault; }
  else if(e.kind==='grow') {
    for(const [value,max] of [[e.species,4],[e.tier,3],[e.infusion,2]])if(!Number.isInteger(value)||value<0||value>max)throw Error('Choose a valid seed and potion.');
    if(a.flowers.filter(f=>!f.sold).length>=100)throw Error('Sell some flowers before planting more.');
    const cost=costOf(e.tier);if(BigInt(a.balance)<cost)throw Error('Not enough game ARCA. Deposit existing wallet ARCA or choose a smaller potion.');
    add(a,'balance',-cost);add(l,'credits',-cost);add(l,'fees',cost/10n);add(l,'reserved',rewardOf(e.tier,3));
    const f={id:e.id,species:e.species,tier:e.tier,infusion:e.infusion,rarity:rarityOf(e.roll),created:at,readyAt:at+9000,sold:false};
    a.flowers=a.flowers.filter(f=>!f.sold).concat(a.flowers.filter(f=>f.sold).slice(-50),f);
    result={...result,id:e.id,amount:cost.toString()};
  } else if(e.kind==='sell') {
    const f=a.flowers.find(f=>f.id===e.id);if(!f||f.sold)throw Error('This flower was already sold or is unavailable.');if(f.readyAt>at)throw Error('Your flower is still growing.');
    const reward=rewardOf(f.tier,f.rarity);f.sold=true;f.soldAt=at;add(a,'balance',reward);add(l,'credits',reward);add(l,'reserved',-rewardOf(f.tier,3));result={...result,id:f.id,amount:reward.toString()};
  } else if(e.kind==='withdraw') {
    if(a.withdrawals.some(w=>w.status==='pending'))throw Error('Finish or recover your pending withdrawal first.');
    const n=positive(e.amount);if(n>BigInt(a.balance))throw Error('Withdrawal exceeds your game balance.');
    add(a,'balance',-n);add(l,'credits',-n);add(l,'pending',n);
    const w={nonce:e.nonce,amount:e.amount,deadline:e.deadline,status:'pending',created:at};a.withdrawals=a.withdrawals.slice(-19).concat(w);result={...result,...w};
  } else if(e.kind==='paid'||e.kind==='expired') {
    const w=a.withdrawals.find(w=>w.nonce===e.nonce);if(!w||w.status!=='pending')throw Error('This withdrawal has already been settled.');
    const n=BigInt(w.amount);add(l,'pending',-n);w.status=e.kind;w.hash=e.hash||null;
    if(e.kind==='paid')add(l,'backing',-n);else{add(l,'credits',n);add(a,'balance',n);}result={...result,amount:w.amount,nonce:w.nonce,hash:w.hash};
  } else throw Error('Unknown operation.');
  assertBacked(l);
  if(!['reserve','setup'].includes(e.kind))a.history=[result,...a.history].slice(0,50);
  return result;
}

export function database(env) { if(!env.DB)throw Error('Game storage is unavailable. No balance was changed.'); return env.DB; }
export async function readLedger(db) {
  await db.prepare('INSERT OR IGNORE INTO ledger (id, revision, stamp, data) VALUES (1, 0, ?, ?)').bind('',JSON.stringify(emptyLedger())).run();
  const row=await db.prepare('SELECT revision, data FROM ledger WHERE id = 1').first();
  return {revision:row.revision,value:JSON.parse(row.data)};
}
export async function readAccount(db,wallet) { const row=await db.prepare('SELECT data FROM accounts WHERE wallet = ?').bind(wallet).first();return row?JSON.parse(row.data):emptyAccount(); }
// A global CAS serializes treasury + account writes. D1 batch is atomic. Every
// statement is gated by the winning operation; its durable receipt is last.
// No network calls or randomness are performed inside retries.
export async function transact(db,{id,fingerprint,wallet,event,now=Date.now()}) {
  for(let retry=0;retry<8;retry++) {
    const previous=await db.prepare('SELECT fingerprint, result FROM operations WHERE id = ?').bind(id).first();
    if(previous){if(previous.fingerprint!==fingerprint)throw Error('This request ID was already used for another action.');return JSON.parse(previous.result);}
    const {revision,value:l}=await readLedger(db),a=await readAccount(db,wallet);
    let result;
    try { result=change(l,a,event,now); } catch(e) { e.unchanged=true; throw e; }
    const gate='EXISTS (SELECT 1 FROM ledger WHERE id = 1 AND stamp = ?) AND NOT EXISTS (SELECT 1 FROM operations WHERE id = ?)';
    await db.batch([
      db.prepare('UPDATE ledger SET revision = revision + 1, stamp = ?, data = ? WHERE id = 1 AND revision = ? AND NOT EXISTS (SELECT 1 FROM operations WHERE id = ?)').bind(id,JSON.stringify(l),revision,id),
      db.prepare(`INSERT INTO accounts (wallet, data) SELECT ?, ? WHERE ${gate} ON CONFLICT(wallet) DO UPDATE SET data = excluded.data`).bind(wallet,JSON.stringify(a),id,id),
      db.prepare(`INSERT INTO operations (id, fingerprint, result) SELECT ?, ?, ? WHERE ${gate}`).bind(id,fingerprint,JSON.stringify(result),id,id)
    ]);
    const saved=await db.prepare('SELECT fingerprint, result FROM operations WHERE id = ?').bind(id).first();
    if(saved){if(saved.fingerprint!==fingerprint)throw Error('Conflicting request ID.');return JSON.parse(saved.result);}
  }
  throw Error('The garden is busy. Retry the same request; it will not charge twice.');
}
