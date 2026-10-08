import {walletTransfer} from './receipt.js';
import {BrowserProvider,Contract,ContractFactory,formatEther,parseEther,getAddress} from 'ethers';
import artifact from './arcana-contract.json';
import deployment from './arcana-deployment.json';
import {gamePage} from './game-page.js';
import {SEEDS,INFUSIONS,POTIONS,RARITIES,FORMS,specimen,growingArt,rarityForRoll,potion,potionSVG,inventoryKey,INITIAL_RESERVE,rewardAmount,quoteArca} from './world.js';
import './game.css';
import './garden-v3.css';

const $=s=>document.querySelector(s), SEPOLIA='0xaa36a7', KEY='arcana:v6:';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=v=>v?`${v.slice(0,6)}…${v.slice(-4)}`:'Not connected';
const amount=v=>formatEther(v).replace(/\.0$/,'');
function saved(key,fallback){try{return JSON.parse(localStorage.getItem(KEY+key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(KEY+key,JSON.stringify(value));}catch{/* Wallet state still comes from the chain when browser storage is unavailable. */}}
let address=deployment.address||saved('address','');
if(!/^0x[\da-f]{40}$/i.test(address))address='';
let provider,injected,account='',contract,busy=false,practice=false,filter='all',flowers=[],claimable=0n,balance=0n,limit=12,total=0,loadId=0;
let inventory=Array(12).fill(0n),starterClaimed=false;
let demoFlowers=[],demoCredit=0n,demoBalance=0n,demoInventory=Array(12).fill(0n),demoStarter=false,selectedSeed=0,wateringId=null;
let walletBlock=0, activeTransaction=null;
let reviewAction,celebrationTimer,refreshing=false,lastGardenMarkup='';
const unit=10n**18n;
const blankLedger=()=>({pool:INITIAL_RESERVE,locked:0n,fees:0n,earned:0n,operator:'',eth:0n});
let ledger=blankLedger(),demoLedger=blankLedger(),ethBalance=null,demoEth=100000000000000000n;
const state=()=>({inventory:practice?demoInventory:inventory,balance:practice?demoBalance:balance,credit:practice?demoCredit:claimable,starter:practice?demoStarter:starterClaimed,ledger:practice?demoLedger:ledger});
let receipts=saved('receipts',[]);if(!Array.isArray(receipts))receipts=[];
receipts=receipts.filter(r=>/^0x[\da-f]{64}$/i.test(r?.hash)&&/^0x[\da-f]{40}$/i.test(r?.address));
const announced=[];
window.addEventListener('eip6963:announceProvider',e=>{if(e.detail?.info?.rdns==='io.metamask')announced.push(e.detail.provider);});
window.dispatchEvent(new Event('eip6963:requestProvider'));
$('#app').innerHTML=gamePage;

function notify(message,error=false){$('#notice').hidden=false;$('#notice').classList.toggle('error',error);$('#notice').textContent=message;}
function errorText(e){return e.code===4001||e.code==='ACTION_REJECTED'?'Declined in MetaMask. No new transaction was approved.':e.code===-32002?'A request is waiting in MetaMask. Open your wallet to continue.':e.reason||e.shortMessage||e.message||'Please try again.';}
function celebrate(message){clearTimeout(celebrationTimer);$('#celebration').textContent='✧ '+message;$('#celebration').hidden=false;celebrationTimer=setTimeout(()=>$('#celebration').hidden=true,6500);}
function lock(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);if(!value){render();updateRecipe();}}
function recipe(){
  const tier=Number($('#potion-tier').value),infusion=Number($('#brew-infusion').value);
  const quantity=Number($('#potion-quantity').value);
  if(!Number.isInteger(quantity)||quantity<1||quantity>20)throw new Error('Choose 1 to 20 bottles.');
  return {tier,infusion,quantity,potion:potion(tier,infusion),cost:BigInt(POTIONS[tier].price*quantity)*unit};
}
function exchangeQuote(){const wei=parseEther($('#exchange-amount').value.trim());return {wei,tokens:quoteArca(wei)};}
function updateExchange(){
  const native=practice?demoEth:ethBalance;
  $('#exchange-wallet').textContent=native===null?'Connect MetaMask to see your Sepolia ETH balance.':`${practice?'PRACTICE':'WALLET'} · ${amount(native)} Sepolia ETH`;
  $('#exchange-buy').textContent=practice?'Exchange practice ETH for ARCA ✧':'Exchange ETH for ARCA · MetaMask ↗';
  try{const q=exchangeQuote();$('#exchange-output').textContent=amount(q.tokens);
    const shortfall=native!==null&&(practice?native<q.wei:native<=q.wei);
    $('#exchange-buy').disabled=busy||shortfall;
    $('#exchange-hint').textContent=shortfall?'Not enough Sepolia ETH. Leave some ETH for network gas.':practice?'Simulated exchange only. No wallet transaction.':'Receive ARCA after MetaMask confirmation. Keep additional Sepolia ETH for gas.';
  }catch(e){$('#exchange-output').textContent='—';$('#exchange-buy').disabled=true;$('#exchange-hint').textContent='Enter 0.0001 to 0.1 Sepolia ETH, using a decimal amount.';}
}
function updateRecipe(){
  try{const r=recipe();$('#potion-preview').innerHTML=`<span class="eyebrow">${r.potion.tier}</span>${potionSVG(r.potion)}<span class="infusion-label">${r.potion.infusion.name}</span><small>${r.potion.recipe}</small>`;
    $('#potion-preview').style.setProperty('--potion-color',r.potion.infusion.color);$('#recipe-title').textContent=r.potion.name;$('#recipe-copy').textContent=`${r.potion.infusion.name} · ${r.quantity} bottle${r.quantity===1?'':'s'} · ${SEEDS[selectedSeed].name} · one transaction to grow.`;
    $('#reward-range').innerHTML=`${r.potion.base}–${r.potion.base*10} <span>ARCA</span>`;
    $('#brew-cost').textContent=`${practice?'Practice price':'Purchase total'}: ${amount(r.cost)} ARCA${practice?' · no transaction':' + network gas'}.`;
    const insufficient=(practice||contract)&&state().balance<r.cost;
    const l=state().ledger,reserveLow=(practice||contract)&&l.pool+r.cost*9n/10n<l.locked+rewardAmount(r.tier,3)*BigInt(r.quantity);
    $('#purchase-split').textContent=`Included: ${amount(r.cost/10n)} ARCA site fee · ${amount(r.cost*9n/10n)} ARCA to the buyback pool. Selection is free. Start growing uses one network transaction.`;
    $('#brew-validation').textContent=reserveLow?'Pip’s reserve is fully committed. New purchases are paused until reserve space becomes available.':insufficient?'Not enough ARCA. Use Get ARCA above, claim the starter gift, or withdraw earnings.':practice?'Practice purchases use simulated ARCA only.':'One confirmation buys the potion, plants and waters. ARCA is spent only after confirmation.';
    $('#buy').disabled=busy||insufficient||reserveLow;
  }catch(e){$('#brew-validation').textContent=e.message;$('#buy').disabled=true;}
}
function updateWithdrawal(){
  const credit=state().credit;$('#withdraw-max').disabled=busy||credit===0n;
  try{const value=parseEther($('#withdraw-amount').value.trim());if(value<=0n||value>credit)throw new Error('Enter an amount greater than zero, up to '+amount(credit)+' ARCA.');$('#claim').disabled=busy||(!practice&&!contract);$('#withdraw-hint').textContent=practice?'Practice withdrawal: no tokens enter a real wallet.':'Sends ARCA to your connected wallet. Only Sepolia gas is charged.';}
  catch(e){$('#claim').disabled=true;$('#withdraw-hint').textContent=credit===0n?'Sell a mature flower to earn withdrawable ARCA.':$('#withdraw-amount').value?e.message:`Available: ${amount(credit)} ARCA. Choose Max or enter an amount.`;}
}
function render(){
  const st=state();$('#practice-banner').hidden=!practice;$('#mode-toggle').textContent=practice?'Return to Sepolia ↗':'Try the practice realm ↗';
  $('#workbench-mode').textContent='FREE SEED SELECTION · NO GAS';
  $('#plant').textContent='Choose potion · free →';$('#buy').textContent=practice?'Start growing · practice ✧':'Start growing · MetaMask ↗';
  $('#network-status').textContent=practice?'Practice realm':account?'Connected to Sepolia':'Wallet not connected';
  $('#wallet-address').textContent=practice?'Simulated flowers, potions and balances — no real transactions.':account||'Connect MetaMask to find your flowers.';
  $('#connect').textContent=account?short(account):'Connect Wallet ↗';$('#contract-link').hidden=!address||practice;if(address)$('#contract-link').href=`https://sepolia.etherscan.io/address/${address}`;
  $('#deployment-detail').textContent=address?`V6 garden & ARCA token: ${address}`:'No ArcanaGarden V6 deployment configured yet.';$('#address-form').elements.address.value=address;$('#export').hidden=!address;
  $('#claimable').textContent=practice||contract?amount(st.credit):'—';$('#token-balance').textContent=practice||contract?amount(st.balance):'—';
  $('#wallet-petals').textContent=`${practice?'PRACTICE':'WALLET'} · ${practice||contract?amount(st.balance):'—'} ARCA`;
  $('#starter').textContent=st.starter?'Starter gift collected ✓':practice?'Claim 100 practice ARCA ✧':'Claim 100 starter ARCA ↗';$('#starter').disabled=busy||st.starter;
  $('#claimable-label').textContent=practice?'PRACTICE EARNINGS':'GARDEN EARNINGS';$('#balance-label').textContent=practice?'PRACTICE BALANCE':'IN YOUR WALLET';
  $('#claim').textContent=practice?'Withdraw practice ARCA ✧':'Withdraw ARCA to MetaMask ↗';$('#watch-token').disabled=busy||practice||!contract;
  $('#selected-seed').textContent=SEEDS[selectedSeed].name;
  document.querySelectorAll('[data-seed]').forEach(b=>{const yes=Number(b.dataset.seed)===selectedSeed;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));b.querySelector('.seed-selected').textContent=yes?'Selected ✧':'Select seed';});
  const bottles=st.inventory.reduce((a,b)=>a+b,0n);$('#potion-count').textContent=`${bottles} ${practice?'PRACTICE ':''}BOTTLES`;
  $('#advanced-satchel').hidden=!st.inventory.some(n=>n>0n);
  $('#satchel').innerHTML=st.inventory.map((n,i)=>n>0n?`<div class="satchel-item" style="--magic:${INFUSIONS[i%3].color}"><span>✧</span><div><b>${POTIONS[Math.floor(i/3)].name}</b><small>${INFUSIONS[i%3].name}</small></div><strong>×${n}</strong></div>`:'').join('')||'<p class="fine">Start growing uses its potion immediately. Unused bottles appear here.</p>';
  const list=practice?demoFlowers:flowers;$('#flower-count').textContent=`${practice?list.length:total} ${practice?'PRACTICE ':''}FLOWERS`;$('#more').hidden=practice||total<=limit;
  const visible=list.filter(f=>filter==='all'||filter==='sold'&&f.sold||filter==='ready'&&f.ready&&!f.sold||filter==='seed'&&!f.watered||filter==='growing'&&f.watered&&!f.ready);
  const markup=visible.map(f=>{
    const grade=RARITIES[f.rarity],title=f.ready?FORMS[f.species][f.rarity]:SEEDS[f.species].name;
    const art=f.ready?specimen(f.species,f.rarity):f.watered?growingArt(f.species,f.phase,f.infusion):`<div class="planted-art">${specimen(f.species,0,true)}<span class="soil-ring"></span></div>`;
    const copy=f.sold?'Pip has collected this flower. The sale payment was sent directly to your wallet.':!f.watered?'Your seed is planted. Give it one potion from your satchel to awaken it.':f.ready?f.expired?'The preservation window passed. A Common bloom remains.':f.revealed?(practice?'Your practice bloom is ready. Keep it or sell it to Pip.':'Preserved on-chain. Keep this flower or sell it whenever you like.'):`Sell or preserve before block ${f.revealBlock+257} to keep this mutation.`:practice?'A little magic is taking root. Practice growth takes nine seconds.':`Watering confirmed. Waiting for ${f.blocksLeft} more block${f.blocksLeft===1?'':'s'} before the final bloom.`;
    return `<article class="flower-card ${f.ready?'is-bloomed':''}" style="--rarity:${grade.color}" data-flower="${f.id}"><div class="flower-art"><div class="card-top"><span>${practice?'PRACTICE':'SPECIMEN'} ${String(f.id+1).padStart(3,'0')}</span><span class="pill">${f.sold?'Sold to Pip':f.ready?grade.label:f.watered?'Growing':'Planted'}</span></div>${art}<span class="mutation-tag">${f.ready?grade.name+' mutation':f.watered?['','A first awakening','Gathering its magic'][f.phase]:'A little promise in the soil'}</span></div><div class="flower-body"><small>${f.watered?INFUSIONS[f.infusion].name+' · '+POTIONS[f.tier].name:'SEED '+String(f.species+1).padStart(2,'0')+' · READY TO WATER'}</small><h3>${title}</h3><p>${copy}</p>${f.watered?`<div class="growth-track"><span style="width:${f.ready?100:f.phase===1?33:67}%"></span></div><div class="offer"><span>${f.sold?'SALE PRICE':'PIP’S OFFER'}</span><b>${f.ready?amount(f.reward):'…'} <small>ARCA</small></b></div>`:''}${f.sold?'<span class="sold-stamp">✓ Collected by Pip</span>':!f.watered?`<button class="button full" data-water="${f.id}" ${busy?'disabled':''}>Choose a potion ✧</button>`:f.ready?`<button class="button full" data-sell="${f.id}" ${busy?'disabled':''}>Sell to Pip${practice?' · practice':' · MetaMask ↗'}</button>${!f.revealed&&!practice?`<button class="text-button preserve" data-preserve="${f.id}" ${busy?'disabled':''}>Keep this bloom · preserve ↗</button>`:''}`:'<button class="button full" disabled>Growing · a little patience…</button>'}</div></article>`;
  }).join('')||`<div class="empty-garden"><span>✧</span><h3>${filter==='all'?'Your next wonder starts with a seed.':'No flowers in this corner yet.'}</h3><p>${practice?'Choose any of the five seeds, then buy and use a practice potion.':!account?'Connect MetaMask to start your own on-chain garden.':!contract?'Open Contract to deploy or select ArcanaGarden V6.':'Choose a seed from the cabinet, or try a different garden filter.'}</p><a href="#seed-library" class="quiet-link">Visit the seed cabinet ↗</a></div>`;
  // Avoid restarting growth animations on unchanged block polls.
  if(lastGardenMarkup!==markup){$('#flowers').innerHTML=markup;lastGardenMarkup=markup;}
  const l=st.ledger,known=practice||contract;
  $('#ledger-mode').textContent=practice?'PRACTICE LEDGER · simulated ARCA only':contract?'LIVE SEPOLIA LEDGER · read from the contract':'Connect a verified V6 garden to view its live ledger.';
  for(const [id,value] of [['fees-earned',l.earned],['fees-available',l.fees],['pool-balance',l.pool],['pool-locked',l.locked]])$('#'+id).textContent=known?amount(value):'—';
  $('#operator-address').textContent=practice?'Practice mode does not pay site fees to any real wallet.':contract?'Site operator: '+l.operator:'';
  const operator=!practice&&contract&&account.toLowerCase()===l.operator.toLowerCase();
  $('#claim-site-fees').hidden=!operator;$('#claim-site-fees').disabled=busy||l.fees===0n;
  $('#eth-revenue').textContent=known?amount(l.eth)+' ETH':'—';
  $('#claim-eth-revenue').hidden=!operator;$('#claim-eth-revenue').disabled=busy||l.eth===0n;
  $('#pending-withdrawals').hidden=st.credit===0n;
  $('#saved-earnings').hidden=st.credit===0n;
  paintWallet();
  updateExchange();updateRecipe();updateWithdrawal();paintHistory();
}
function paintWallet(){
  $('#wallet-mode').textContent=practice?'PRACTICE WALLET · SIMULATED':'YOUR SEPOLIA WALLET';
  $('#wallet-live-balance').textContent=practice?amount(demoBalance):contract?amount(balance):'—';
  $('#wallet-live-address').textContent=practice?'Practice tokens never enter MetaMask.':account||'Connect MetaMask to read your token balance.';
  $('#wallet-sync').textContent=practice?'Simulation only · no on-chain transfers':contract?`Verified on Sepolia at block ${walletBlock}. ARCA and ETH are separate balances.`:account?'Wallet balance unavailable. Refresh to retry.':'Balances come from the blockchain.';
  $('#wallet-token-address').textContent=address;
  $('#wallet-explorer').hidden=practice||!account||!address;
  $('#wallet-explorer').href=`https://sepolia.etherscan.io/token/${address}?a=${account}`;
  $('#wallet-refresh').disabled=busy||practice||!account;
}
function receiptBody(r){
  const confirmed=r.status==='Confirmed',proof=r.proof;
  const delta=confirmed&&proof?`<div class="transfer-proof"><strong>${BigInt(proof.net)>=0n?'+':''}${amount(BigInt(proof.net))} ARCA</strong><span>${BigInt(proof.received)>0n?amount(BigInt(proof.received))+' ARCA received by your wallet':BigInt(proof.sent)>0n?amount(BigInt(proof.sent))+' ARCA spent from your wallet':'No ARCA transfer in this transaction'}</span><small>Verified from this token’s Transfer events · block ${esc(r.blockNumber)}</small>${r.networkFee?`<small>Network fee: ${amount(BigInt(r.networkFee))} Sepolia ETH · separate from ARCA</small>`:''}<small class="break">Wallet: ${esc(r.account)}</small></div>`:'';
  return `<b>${esc(r.label)} · ${esc(r.status)}</b>${delta}${r.hash?`<a class="break" href="https://sepolia.etherscan.io/tx/${r.hash}" target="_blank" rel="noreferrer">Transaction: ${r.hash}</a>`:'<p>Review the request in MetaMask. No transaction has been submitted yet.</p>'}${r.status==='Pending'?'<p>Submitted to Sepolia. Your balance changes only after confirmation.</p>':''}`;
}
function paintHistory(){
  const list=receipts.filter(r=>r.address.toLowerCase()===address.toLowerCase()&&account&&r.account?.toLowerCase()===account.toLowerCase()).slice(0,10),recent=activeTransaction||list[0];
  $('#latest-transaction').hidden=practice||!recent;
  if(!practice&&recent)$('#latest-transaction').innerHTML=receiptBody(recent);
  $('#history').innerHTML=practice?'<p class="empty-history">Practice leaves no blockchain receipts. Return to Sepolia to view your real spellbook.</p>':list.map(r=>`<article class="receipt-entry">${receiptBody(r)}</article>`).join('')||'<p class="empty-history">No receipts saved in this browser. Use View ARCA transfers above for your complete token history.</p>';
}
function record(label,hash,status,contractAddress=address,details={}){
  const old=receipts.find(r=>r.hash===hash);
  if(old){old.status=status;if(contractAddress)old.address=contractAddress;Object.assign(old,details);}else if(contractAddress)receipts.unshift({label,hash,status,address:contractAddress,account,...details});
  receipts=receipts.slice(0,100);save('receipts',receipts);paintHistory();
}
function recordConfirmed(label,receipt,owner=account,token=address){
  const t=walletTransfer(receipt,token,owner);
  record(label,receipt.hash,'Confirmed',token,{account:owner,blockNumber:receipt.blockNumber,networkFee:receipt.fee?.toString(),proof:{received:String(t.received),sent:String(t.sent),net:String(t.net)}});
  return t;
}
async function verify(candidate){if((await provider.getCode(candidate)).toLowerCase()!==artifact.deployedBytecode.toLowerCase())throw new Error('This is not the ArcanaGarden V6 contract on Sepolia. Earlier garden versions need a new deployment.');}
async function connect(){
  injected=announced[0]||window.ethereum?.providers?.find(p=>p.isMetaMask)||(window.ethereum?.isMetaMask?window.ethereum:null);
  if(!injected)throw new Error('MetaMask was not found. Open this website in Chrome with MetaMask installed, or the MetaMask mobile browser.');
  await injected.request({method:'eth_requestAccounts'});
  if(await injected.request({method:'eth_chainId'})!==SEPOLIA)await injected.request({method:'wallet_switchEthereumChain',params:[{chainId:SEPOLIA}]});
  provider=new BrowserProvider(injected);account=await(await provider.getSigner()).getAddress();ethBalance=await provider.getBalance(account);
  if(!injected._arcanaListeners){injected.on('accountsChanged',()=>location.reload());injected.on('chainChanged',()=>location.reload());injected._arcanaListeners=true;}
  await load();render();
}
async function load(minimumBlock=0){
  if(practice)return render();const request=++loadId;
  if(!provider||!address){contract=null;flowers=[];total=0;claimable=0n;balance=0n;inventory=Array(12).fill(0n);starterClaimed=false;return render();}
  try{
    const candidate=address;await verify(candidate);const next=new Contract(candidate,artifact.abi,provider);
    const block=Math.max(minimumBlock,Number(await provider.send('eth_blockNumber',[])));const opts={blockTag:block};
    const [size,credit,tokens,starter,bag,market,native]=await Promise.all([next.gardenSize(account,opts),next.claimable(account,opts),next.balanceOf(account,opts),next.starterClaimed(account,opts),Promise.all(Array.from({length:12},(_,i)=>next.potions(account,Math.floor(i/3),i%3,opts))),Promise.all([next.poolReserve(opts),next.reservedRewards(opts),next.siteRevenue(opts),next.totalSiteRevenue(opts),next.operator(opts),next.ethRevenue(opts)]),provider.getBalance(account,block)]);
    const count=Number(size),indices=Array.from({length:Math.min(limit,count)},(_,i)=>count-1-i);
    const rows=await Promise.all(indices.map(async i=>{const id=await next.gardenId(account,i,opts);const [f,b]=await Promise.all([next.flowers(id,opts),next.previewBloom(id,opts)]);return {id:Number(id),species:Number(f.species),infusion:Number(f.infusion),tier:Number(f.tier),revealBlock:Number(f.revealBlock),revealed:f.revealed,watered:f.watered,phase:block<Number(f.revealBlock)?1:2,sold:f.sold,ready:b.ready,rarity:Number(b.rarity),reward:b.reward,expired:b.expired,blocksLeft:Math.max(0,Number(f.revealBlock)+1-block)};}));
    if(request!==loadId||practice)return;
    walletBlock=block;contract=next;total=count;flowers=rows;claimable=credit;balance=tokens;inventory=bag;starterClaimed=starter;ledger={pool:market[0],locked:market[1],fees:market[2],earned:market[3],operator:market[4],eth:market[5]};ethBalance=native;
    const pending=receipts.filter(r=>r.address.toLowerCase()===candidate.toLowerCase()&&(['Pending','Unconfirmed · check explorer'].includes(r.status)||(r.status==='Confirmed'&&!r.proof)));
    await Promise.all(pending.map(async r=>{try{const receipt=await provider.getTransactionReceipt(r.hash);if(receipt){if(receipt.status===1)recordConfirmed(r.label,receipt,r.account,candidate);else record(r.label,r.hash,'Reverted',candidate);}}catch{/* A pending receipt is retried on the next refresh. */}}));
    render();return true;
  }catch(e){if(request!==loadId)return;contract=null;flowers=[];claimable=0n;balance=0n;inventory=Array(12).fill(0n);starterClaimed=false;total=0;render();notify('Could not refresh live data: '+errorText(e),true);return false;}
}
async function ensureGarden(){if(practice)return true;if(!account)await connect();if(!contract){if(address){notify('Could not read the configured garden. Refresh wallet balance and try again; no new deployment is needed.',true);}else{$('#setup-dialog').showModal();notify('Select a deployed garden before playing.');}return false;}return true;}
function review(title,html,action){$('#review-title').textContent=title;$('#review-copy').innerHTML=html;reviewAction=action;$('#review-dialog').showModal();}
async function transact(label,action,isDeploy=false){
  if(busy)return;lock(true);let tx,confirmed=false;const previousAddress=address;
  try{
    if(!account)await connect();
    if(await injected.request({method:'eth_chainId'})!==SEPOLIA)throw new Error('Switch MetaMask to Sepolia.');
    const signer=await provider.getSigner();if((await signer.getAddress()).toLowerCase()!==account.toLowerCase())throw new Error('Wallet changed. Refresh and reconnect.');
    if(!isDeploy&&!contract)throw new Error('Select a verified ArcanaGarden contract first.');
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    activeTransaction={label,status:'Awaiting MetaMask approval'};paintHistory();
    notify(`${label}: open MetaMask and review the transaction.`);
    tx=await action(signer);activeTransaction=null;record(label,tx.hash,'Pending',isDeploy?'':address);
    notify(`${label}: submitted. Waiting for Sepolia confirmation…`);
    let receipt;
    try{receipt=await tx.wait();}catch(e){if(e.code==='TRANSACTION_REPLACED'){record(label,tx.hash,e.cancelled?'Cancelled / replaced':'Replaced');if(e.cancelled)throw e;tx=e.replacement;receipt=e.receipt;}else throw e;}
    if(!receipt||receipt.status!==1)throw new Error('Transaction reverted. No game state changed.');
    confirmed=true;
    if(isDeploy){address=getAddress(receipt.contractAddress);save('address',address);save('deployment',{chainId:11155111,address,transactionHash:receipt.hash});}
    const transfer=recordConfirmed(label,receipt);const loaded=await load(receipt.blockNumber);
    notify(`${label} confirmed in block ${receipt.blockNumber}. ${loaded===false?'Live refresh failed; use Refresh garden.':'Your on-chain garden is up to date.'}`);
    celebrate(transfer.received>0n?`${amount(transfer.received)} ARCA received by ${short(account)}. Verified in your transaction receipt.`:label+' confirmed.');
    $('#latest-transaction').scrollIntoView({behavior:'smooth',block:'center'});
  }catch(e){activeTransaction=null;if(tx&&!confirmed)record(label,tx.hash,e.code==='TRANSACTION_REPLACED'?'Cancelled / replaced':e.receipt?.status===0?'Reverted':'Unconfirmed · check explorer',isDeploy?previousAddress:address);notify(errorText(e),true);}
  finally{activeTransaction=null;lock(false);}
}
function togglePractice(){if(busy)return;practice=!practice;++loadId;filter='all';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='all'));$('#notice').hidden=true;render();updateRecipe();if(!practice)load();}
$('#mode-toggle').onclick=togglePractice;$('#leave-practice').onclick=togglePractice;
$('#connect').onclick=async()=>{if(busy)return;lock(true);try{await connect();notify('Wallet connected to Sepolia. Your private key stays in MetaMask.');}catch(e){notify(errorText(e),true);}finally{lock(false);}};
$('#setup-open').onclick=()=>$('#setup-dialog').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#review-confirm').onclick=()=>{const action=reviewAction;reviewAction=null;$('#review-dialog').close();action?.();};
$('#review-dialog').addEventListener('close',()=>{reviewAction=null;});
$('#exchange-amount').oninput=updateExchange;document.querySelectorAll('[data-exchange]').forEach(b=>b.onclick=()=>{$('#exchange-amount').value=b.dataset.exchange;updateExchange();});
['potion-tier','brew-infusion'].forEach(id=>$('#'+id).onchange=updateRecipe);$('#potion-quantity').oninput=updateRecipe;
$('#withdraw-amount').oninput=updateWithdrawal;$('#withdraw-max').onclick=()=>{$('#withdraw-amount').value=amount(state().credit);updateWithdrawal();};
document.querySelectorAll('[data-seed]').forEach(b=>b.onclick=()=>{selectedSeed=Number(b.dataset.seed);render();});
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render();});
$('#refresh').onclick=()=>load();$('#wallet-refresh').onclick=()=>load();$('#more').onclick=()=>{limit+=12;load();};
function showAll(){filter='all';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='all'));}
async function prepare(action){if(busy)return;try{if(await ensureGarden())action();}catch(e){notify(errorText(e),true);}}
$('#exchange-buy').onclick=()=>prepare(()=>{try{const q=exchangeQuote();if(practice){if(demoEth<q.wei)throw new Error('Not enough practice ETH.');demoEth-=q.wei;demoBalance+=q.tokens;demoLedger.eth+=q.wei;render();celebrate(`${amount(q.tokens)} practice ARCA received. Visit the potion shop!`);return;}
  review('Exchange ether for petals.',`<p>Pay <b>${amount(q.wei)} Sepolia ETH</b> plus network gas to receive <b>${amount(q.tokens)} ARCA</b> in wallet <span class="break">${esc(account)}</span>.</p><p>Fixed rate: 0.001 test ETH = 100 ARCA. No exchange fee. This is a one-way test-token purchase, with no ETH redemption. Confirm the payment in MetaMask.</p>`,()=>transact('ETH exchanged for ARCA',s=>contract.connect(s).buyArca(q.tokens,{value:q.wei})));
}catch(e){notify(errorText(e),true);}});
$('#starter').onclick=()=>prepare(()=>{if(practice){if(demoStarter)return;demoStarter=true;demoBalance+=100n*unit;render();celebrate('100 practice ARCA added. Visit the potion shop!');return;}review('A welcome gift from Pip.', '<p>Receive 100 ARCA test tokens in your wallet. One starter grant per wallet. No ETH payment; Sepolia gas is required.</p>',()=>transact('Starter ARCA collected',s=>contract.connect(s).claimStarter()));});
$('#plant').onclick=()=>{$('#workbench').scrollIntoView({behavior:'smooth'});$('#potion-tier').focus({preventScroll:true});};
$('#buy').onclick=()=>prepare(()=>{try{const r=recipe(),species=selectedSeed;if(state().balance<r.cost)throw new Error('Not enough ARCA. Exchange Sepolia ETH at Get ARCA or withdraw flower-sale earnings.');if(practice){const max=rewardAmount(r.tier,3)*BigInt(r.quantity);if(demoLedger.pool+r.cost*9n/10n<demoLedger.locked+max)throw new Error('Buyback reserve is fully committed.');demoLedger.pool+=r.cost*9n/10n;demoLedger.locked+=max;demoLedger.fees+=r.cost/10n;demoLedger.earned+=r.cost/10n;demoBalance-=r.cost;for(let n=0;n<r.quantity;n++)demoFlowers.unshift({id:demoFlowers.length,species,watered:true,ready:false,sold:false,rarity:0,tier:r.tier,infusion:r.infusion,revealed:false,phase:1,wateredAt:Date.now(),readyAt:Date.now()+9000});showAll();render();celebrate('Seeds planted and watered. Watch your garden grow!');$('#my-garden').scrollIntoView({behavior:'smooth'});return;}review('Start your little garden.',`<p>${r.quantity} × <b>${SEEDS[species].name}</b> with <b>${r.potion.name}</b> · ${r.potion.infusion.name}</p><div class="review-amount">${amount(r.cost)} <small>ARCA + network gas</small></div><p>This spends ARCA from your wallet to grow your selected flowers. Of this total, ${amount(r.cost/10n)} ARCA is the included site fee and ${amount(r.cost*9n/10n)} ARCA funds flower buybacks. Ordinary flowers sell below cost. This single transaction buys the potions, plants your selected seeds and waters them. Seed selection is free. There is no separate token allowance or extra planting transaction.</p>`,()=>transact('Garden started',s=>contract.connect(s).growFlowers(species,r.tier,r.infusion,r.quantity)));}catch(e){notify(errorText(e),true);}});
function updateWaterPreview(){const key=Number($('#water-potion').value);if(!Number.isInteger(key)||key<0||key>11)return;const t=Math.floor(key/3),i=key%3;$('#water-preview').innerHTML=`${potionSVG(potion(t,i))}<div><h3>${POTIONS[t].name}</h3><p>${INFUSIONS[i].name} · consumes one bottle</p><span class="fine">Pip’s possible offer: ${POTIONS[t].base}–${POTIONS[t].base*10} ARCA</span></div>`;}
$('#water-potion').onchange=updateWaterPreview;
$('#flowers').onclick=e=>{
  const b=e.target.closest('button');if(!b||busy)return;const id=Number(b.dataset.water??b.dataset.sell??b.dataset.preserve),f=(practice?demoFlowers:flowers).find(f=>f.id===id);if(!f)return;
  if(b.dataset.water!==undefined){const options=state().inventory.map((n,key)=>n>0n?`<option value="${key}">${POTIONS[Math.floor(key/3)].name} · ${INFUSIONS[key%3].name} · ${n} available</option>`:'').join('');if(!options){notify('Your satchel is empty. Buy a potion with ARCA first.');$('#workbench').scrollIntoView({behavior:'smooth'});return;}wateringId=id;$('#water-title').textContent='Awaken your '+SEEDS[f.species].name+'.';$('#water-potion').innerHTML=options;updateWaterPreview();$('#water-confirm').textContent=practice?'Water seed · practice ✧':'Water seed · MetaMask ↗';$('#water-dialog').showModal();return;}
  if(b.dataset.preserve!==undefined){review('Keep this little wonder.',`<p>Preserve <b>${FORMS[f.species][f.rarity]}</b> on-chain. This costs network gas and keeps the flower in your garden.</p>`,()=>transact('Bloom preserved',s=>contract.connect(s).revealBloom(id)));return;}
  if(!f.ready||f.sold)return;if(practice){f.sold=true;demoBalance+=f.reward;demoLedger.pool-=f.reward;demoLedger.locked-=rewardAmount(f.tier,3);render();celebrate(`Pip paid ${amount(f.reward)} practice ARCA directly to your practice wallet.`);return;}
  review('A little trade with Pip.',`<p>Sell <b>${FORMS[f.species][f.rarity]}</b> to Pip for:</p><div class="review-amount">${amount(f.reward)} <small>ARCA directly to your wallet</small></div><p>Your flower will be marked sold, and can only be sold once. The same transaction transfers this flower’s full ARCA price directly to your wallet. No separate withdrawal is needed. If the offer expires and drops, this sale will revert instead of accepting a lower price.</p>`,()=>transact('Flower sold to Pip',s=>contract.connect(s).sellAndClaim(id,f.reward)));
};
$('#water-confirm').onclick=()=>{if(busy)return;const id=wateringId,key=Number($('#water-potion').value),tier=Math.floor(key/3),infusion=key%3;const f=(practice?demoFlowers:flowers).find(f=>f.id===id);if(!f||f.watered||state().inventory[key]<=0n)return;$('#water-dialog').close();
  if(practice){demoInventory[key]-=1n;Object.assign(f,{watered:true,tier,infusion,phase:1,wateredAt:Date.now(),readyAt:Date.now()+9000});render();celebrate('Potion poured. Watch your seed awaken!');return;}
  review('Let the magic take root.',`<p>Use one <b>${POTIONS[tier].name}</b> with ${INFUSIONS[infusion].name} on your ${SEEDS[f.species].name}.</p><p>The bottle is consumed only after confirmation. No extra ARCA is charged. The flower matures after three additional blocks; rarity chances remain 75% / 20% / 4% / 1%.</p>`,()=>transact('Seed watered',s=>contract.connect(s).waterFlower(id,tier,infusion)));
};
$('#claim').onclick=()=>{if(busy)return;try{const value=parseEther($('#withdraw-amount').value.trim());if(value<=0n||value>state().credit)throw new Error('Enter an amount within your available garden earnings.');if(practice){demoCredit-=value;demoBalance+=value;$('#withdraw-amount').value='';render();celebrate(`${amount(value)} practice ARCA withdrawn. You can buy more potions.`);return;}if(!contract)return;review('Your petals, in your wallet.',`<div class="review-amount">${amount(value)} <small>ARCA</small></div><p>Withdraw to <b class="break">${esc(account)}</b>. This transfers earned ARCA tokens, not ETH or cash. MetaMask will ask you to confirm network gas.</p>`,()=>transact('ARCA withdrawn',s=>contract.connect(s).claimPetals(value)));}catch(e){notify(errorText(e),true);}};
setInterval(()=>{let changed=false;for(const f of demoFlowers){if(!f.watered||f.ready)continue;if(Date.now()>=f.readyAt){const rarity=rarityForRoll(crypto.getRandomValues(new Uint32Array(1))[0]%10000);Object.assign(f,{ready:true,revealed:true,rarity,reward:rewardAmount(f.tier,rarity)});changed=true;if(practice)celebrate(`${FORMS[f.species][rarity]} · ${RARITIES[rarity].label}!`);}else if(Date.now()-f.wateredAt>=4500&&f.phase!==2){f.phase=2;changed=true;}}if(changed&&practice)render();},500);
$('#claim-eth-revenue').onclick=()=>{if(busy||practice||!contract)return;const value=ledger.eth;review('Collect exchange receipts.',`<p>Transfer ${amount(value)} Sepolia test ETH from exchange receipts to the operator wallet. ARCA buyback reserves and player earnings stay in the garden.</p>`,()=>transact('Exchange ETH collected',s=>contract.connect(s).claimEthRevenue(value)));};
$('#claim-site-fees').onclick=()=>{if(busy||practice||!contract)return;const value=ledger.fees;review('Collect the site’s earned fees.',`<p>Withdraw ${amount(value)} ARCA of earned site fees to the operator wallet. Protected buyback reserves and player earnings cannot be withdrawn here.</p>`,()=>transact('Site fees withdrawn',s=>contract.connect(s).claimSiteRevenue(value)));};
$('#watch-token').onclick=async()=>{try{if(!contract||practice)return;if(await injected.request({method:'eth_chainId'})!==SEPOLIA)throw new Error('Switch to Sepolia first.');const added=await injected.request({method:'wallet_watchAsset',params:{type:'ERC20',options:{address,symbol:'ARCA',decimals:18}}});notify(added?'ARCA added to MetaMask. View it under your Sepolia tokens.':'Token import was not completed. You can add it manually with the garden contract address.');}catch(e){notify(errorText(e),true);}};
$('#deploy').onclick=()=>{if(practice){notify('Return to Sepolia mode before deploying a real contract.');return;}review('Create your Sepolia garden.',`<p>Deploy ArcanaGarden V6 with the Sepolia ETH-to-ARCA exchange, fixed prices, 10% included site fees and a protected buyback pool. The deploying wallet becomes the fee operator. The contract creates 1,000,000 test ARCA as initial reserve; this is not a real-value deposit. MetaMask will show the deployment gas cost. Keep this address for all players.</p>`,()=>transact('Garden deployed',async s=>{const c=await new ContractFactory(artifact.abi,artifact.bytecode,s).deploy();return c.deploymentTransaction();},true));$('#setup-dialog').close();};
$('#address-form').onsubmit=async e=>{e.preventDefault();if(busy)return;lock(true);try{const candidate=getAddress(e.target.elements.address.value.trim());if(!account)await connect();await verify(candidate);address=candidate;save('address',address);practice=false;$('#setup-dialog').close();await load();notify('ArcanaGarden verified on Sepolia. Choose a seed, claim starter ARCA, and visit the potion shop.');}catch(e){notify(errorText(e),true);}finally{lock(false);}};
$('#export').onclick=()=>{const stored=saved('deployment',{});const record=stored.address===address?stored:{chainId:11155111,address,transactionHash:''};const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='arcana-deployment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
render();updateRecipe();
setInterval(async()=>{if(busy||practice||!account||!address||refreshing||document.querySelector('dialog[open]'))return;refreshing=true;try{await load();}finally{refreshing=false;}},6500);
