import { BrowserProvider, Contract, ContractFactory, formatEther, parseEther, getAddress } from 'ethers';
import artifact from './contract.json';
import deployment from './deployment.json';
import './style.css';
import './arcana.css';
import {page} from './page.js';
import {growth, plantSVG, gardenScene, SPECIES, speciesFor, encodeStory, potionFor, potionSVG} from './garden.js';

const SEPOLIA = '0xaa36a7';
const $ = (s) => document.querySelector(s);
const escape = (v) => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short = (v) => v ? `${v.slice(0,6)}…${v.slice(-4)}` : 'Not connected';
const eth = (v) => formatEther(v);
let injected, provider, account = '', contract, campaigns = [], filter = 'all', busy = false, loadId = 0;
let address = localStorage.getItem('seedfund:address') || deployment.address;
let history;
try { history = JSON.parse(localStorage.getItem('seedfund:history') || '[]'); if (!Array.isArray(history)) history = []; } catch { history = []; }
const announced = [];
window.addEventListener('eip6963:announceProvider', e => { if (e.detail?.info?.rdns === 'io.metamask') announced.push(e.detail.provider); });
window.dispatchEvent(new Event('eip6963:requestProvider'));

$('#app').innerHTML = page;

function actionName(label) { return ({'Campaign created':'Wish planted','Campaign funded':'Potion cast','Funds withdrawn':'Wish harvested','Refund claimed':'Essence returned','Contract deployed':'Garden summoned'})[label] || label; }
function receiptName(status) { return status; }
let celebrationTimer;
function celebrate(label,details={}) {
  const messages={
    'Campaign created':['A new wish has taken root.','Your enchanted seed now lives on Sepolia.'],
    'Campaign funded':[details.potion ? `${details.potion} has been cast.` : 'Your magic has found its roots.','Contribution confirmed. The garden reads its growth from the chain.'],
    'Funds withdrawn':['Your wish is ready for the world.','The creator’s withdrawal is confirmed. Let a new chapter begin.'],
    'Refund claimed':['Your essence has returned.','Your contribution is refunded. Transaction gas is not refunded.'],
    'Contract deployed':['The gates of Arcana are open.','Your contract is on Sepolia. Plant your first enchanted wish.']
  };
  if(!messages[label]) return;
  clearTimeout(celebrationTimer);
  $('#celebration-title').textContent=messages[label][0];
  $('#celebration-copy').textContent=messages[label][1];
  $('#celebration').hidden=false;
  celebrationTimer=setTimeout(()=>$('#celebration').hidden=true,6000);
}
const PRACTICE_GOAL=parseEther('0.005');
let previewRaised=0n, previewTimer;
function paintPreview() {
  const selected=$('#brew-species').value;
  const specimen=SPECIES.find(s=>s.id===selected);
  const plant=growth(previewRaised,PRACTICE_GOAL);
  $('#garden-scene').innerHTML=gardenScene(plant.stage,selected);
  $('#preview-species-label').textContent=`PRACTICE SPECIMEN / ${specimen.name.toUpperCase()}`;
  $('#preview-stage').textContent=['A little magic lies dormant.','The first spell awakens.','Something otherworldly stirs.','A bloom gathers its light.','An impossible flower, at last.'][plant.stage];
  $('#preview-fill').style.width=plant.percent+'%';
  $('#preview-hint').textContent=`Practice: ${formatEther(previewRaised)} / 0.005 test ETH · ${plant.percent}% · off-chain`;
}
function potionMarkup(potion) {
  return `<span class="potion-tier">${potion.tier}</span>${potionSVG(potion)}<h3>${potion.name}</h3><span class="infusion-name">${potion.infusion.adjective} infusion</span><small>${potion.range}</small>`;
}
function updateBrew() {
  try {
    const potion=potionFor(parseEther($('#brew-amount').value||'0'),$('#brew-infusion').value);
    $('#brew-result').innerHTML=potionMarkup(potion);
    $('#brew-result').style.setProperty('--potion-color',potion.infusion.color);
    $('#brew-recipe').textContent=`${potion.recipe} + ${potion.infusion.name}`;
    $('#brew-cast').disabled=busy;
  } catch {
    $('#brew-result').innerHTML='<span class="potion-tier">AN UNFINISHED RECIPE</span><h3>Add a little essence.</h3><small>Enter a positive test ETH amount, up to 18 decimal places.</small>';
    $('#brew-recipe').textContent='The cauldron is waiting for a valid amount.';
    $('#brew-cast').disabled=true;
  }
  document.querySelectorAll('[data-dose]').forEach(b=>{const selected=b.dataset.dose===$('#brew-amount').value;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
}
$('#brew-amount').addEventListener('input',updateBrew);
$('#brew-infusion').addEventListener('change',updateBrew);
function resetPractice() {previewRaised=0n;paintPreview();$('#brew-feedback').textContent='A fresh specimen. Practice brews do not send transactions.';}
$('#brew-species').addEventListener('change',resetPractice);
$('#preview-reset').onclick=resetPractice;
$('#preview-water').onclick=()=>{$('#alchemy').scrollIntoView({behavior:'smooth',block:'center'});$('#brew-amount').focus({preventScroll:true});};
for(const button of document.querySelectorAll('[data-dose]')) button.onclick=()=>{$('#brew-amount').value=button.dataset.dose;updateBrew();};
for(const button of document.querySelectorAll('[data-specimen]')) button.onclick=()=>{$('#brew-species').value=button.dataset.specimen;resetPractice();$('#alchemy').scrollIntoView({behavior:'smooth',block:'center'});};
$('#brew-cast').onclick=()=>{
  try {
    const amount=parseEther($('#brew-amount').value||'0');
    const potion=potionFor(amount,$('#brew-infusion').value);
    const remaining=PRACTICE_GOAL-previewRaised;
    if(remaining===0n)throw new Error('Your specimen has bloomed. Reset it or choose another species to start again.');
    if(amount>remaining)throw new Error(`Only ${formatEther(remaining)} test ETH remains in this practice goal. Lower the amount to finish your bloom.`);
    previewRaised+=amount;paintPreview();
    $('#brew-feedback').textContent=`${potion.name} · ${potion.infusion.adjective} infusion cast! ${growth(previewRaised,PRACTICE_GOAL).name} — ${growth(previewRaised,PRACTICE_GOAL).percent}%. Practice only; no transaction sent.`;
    $('#brew-result').classList.remove('casting');void $('#brew-result').offsetWidth;$('#brew-result').classList.add('casting');
    clearTimeout(previewTimer);$('#garden-scene').classList.add('watering-now');previewTimer=setTimeout(()=>$('#garden-scene').classList.remove('watering-now'),900);
  } catch(e) {$('#brew-feedback').textContent=e.message;}
};
function updateGrowthPreview() {
  const form=$('#fund-form').elements;
  const c=campaigns.find(c=>c.id===Number(form.id.value));
  if(!c)return;
  try {
    const amount=parseEther(form.amount.value||'0');
    const potion=potionFor(amount,form.infusion.value);
    $('#fund-potion').innerHTML=potionMarkup(potion);
    $('#fund-potion').style.setProperty('--potion-color',potion.infusion.color);
    if(amount>c.goal-c.raised)throw new Error('The potion exceeds the remaining goal. Reduce the test ETH amount.');
    const next=growth(c.raised+amount,c.goal);
    $('#fund-growth').textContent=`After confirmation: ${next.name} · ${next.percent}%. ${next.stage===4?'This contribution will complete the bloom.':'Growth follows the final on-chain balance.'}`;
  } catch(e) {$('#fund-growth').textContent=e.message;$('#fund-potion').innerHTML='<span class="potion-tier">ADJUST YOUR RECIPE</span>';}
}
$('#fund-form').elements.amount.addEventListener('input',updateGrowthPreview);
$('#fund-form').elements.infusion.addEventListener('change',updateGrowthPreview);
updateBrew();

function notice(message, error = false) { if(error) document.querySelectorAll('dialog[open]').forEach(d=>d.close()); $('#notice').hidden = false; $('#notice').className = error ? 'error' : ''; $('#notice').textContent = message; }
function errorText(e) { if (e.code === 4001 || e.code === 'ACTION_REJECTED') return 'Request declined in MetaMask. No new transaction was approved.'; if (e.code === -32002) return 'A request is already waiting in MetaMask. Open your wallet to continue.'; return e.reason || e.shortMessage || e.message || 'Something went wrong. Please try again.'; }
function locked(value) { busy = value; document.querySelectorAll('button').forEach(b => b.disabled = value); }
function paintHistory() {
  $('#history').innerHTML = history.filter(h => h.address?.toLowerCase() === address?.toLowerCase()).slice(0, 12).map(h => `<a class="receipt" href="https://sepolia.etherscan.io/tx/${escape(h.hash)}" target="_blank" rel="noreferrer"><span class="receipt-icon">${h.status === 'Confirmed' ? '✓' : '↗'}</span><span><b>${escape(h.potion || actionName(h.label))}</b><small>${h.infusion ? escape(h.infusion)+' infusion · ' : ''}${escape(receiptName(h.status))} · ${escape(short(h.hash))}</small></span><span>↗</span></a>`).join('') || '<div class="empty-activity">No spells are written here yet.<br>Your confirmed on-chain actions will leave a trace.</div>';
}
function record(label, hash, status, details={}) { const existing = history.find(h => h.hash === hash); if (existing) { existing.status = status; existing.address = address; } else history.unshift({label, hash, status, address, ...details}); history = history.slice(0,100); localStorage.setItem('seedfund:history', JSON.stringify(history)); paintHistory(); }
function showAddress() {
  $('#contract-link').hidden = !address;
  if (address) $('#contract-link').href = `https://sepolia.etherscan.io/address/${address}`;
  $('#deployment-detail').textContent = address ? `Active garden contract: ${address}` : 'No contract deployed or selected yet.';
  $('#export').hidden = !address;
  $('#address-form').elements.address.value = address;
}
function status(c) { return c.withdrawn ? 'Paid out' : c.raised >= c.goal ? 'Goal reached' : Number(c.deadline) <= Date.now()/1000 ? 'Ended · refunds open' : 'Open for funding'; }
const statusNames={'Paid out':'Harvested','Goal reached':'In bloom','Ended · refunds open':'Expired · refunds open','Open for funding':'Growing'};
function render() {
  showAddress();paintHistory();
  const visible=campaigns.filter(c=>filter==='all'||filter==='active'&&status(c)==='Open for funding'||filter==='mine'&&c.creator.toLowerCase()===account.toLowerCase()||filter==='backed'&&c.mine>0n);
  if(!contract) {
    $('#cards').innerHTML=`<div class="empty"><div class="empty-plants">${plantSVG(0,0)}${plantSVG(2,1)}${plantSVG(1,2)}</div><h3>${!account?'Beyond these gates, your garden awaits.':'Every sanctuary begins with a seed.'}</h3><p>${!account?'Connect MetaMask to discover real wishes rooted on Sepolia.':'Deploy a contract or enter an existing SeedFund address to open the garden.'}</p><button class="button outline" id="empty-action">${!account?'Connect MetaMask':'Set up the garden'} ↗</button><small>Live campaigns only. Explore the free practice workbench above.</small></div>`;
    $('#empty-action').onclick=()=>!account?connect().catch(e=>notice(errorText(e),true)):$('#setup-dialog').showModal();return;
  }
  $('#cards').innerHTML=visible.map(c=>{
    const state=status(c),active=state==='Open for funding',success=c.raised>=c.goal,mine=c.creator.toLowerCase()===account.toLowerCase();
    const plant=growth(c.raised,c.goal),{species,story}=speciesFor(c.description,c.id);
    const left=Math.max(0,Math.ceil((Number(c.deadline)-Date.now()/1000)/60));
    return `<article class="campaign" aria-label="${escape(c.title)}"><div class="plant-portrait"><div class="card-top"><span class="campaign-number">SPECIMEN ${String(c.id+1).padStart(3,'0')}</span><span class="badge ${success?'success':''}">${statusNames[state]}</span></div>${plantSVG(plant.stage,species.id)}<span class="stage-chip">${plant.name} · ${plant.percent}%</span></div><div class="card-body"><span class="species-caption">${species.name}</span><h3>${escape(c.title)}</h3><p class="story">${escape(story)}</p><span class="creator">KEEPER ${escape(short(c.creator))}${mine?' · YOU':''}</span><div class="funding-line"><b>${eth(c.raised)} <small>ETH</small></b><span>of ${eth(c.goal)} ETH</span></div><progress value="${plant.percent}" max="100" aria-label="Funding progress for ${escape(c.title)}"></progress><div class="card-meta"><span>${c.backers} alchemist${c.backers===1n?'':'s'}</span><span>${active?left>=1440?Math.ceil(left/1440)+' days left':left+' min left':'Contributions closed'}</span></div>${c.mine>0n?`<p class="contribution">Your essence: ${eth(c.mine)} test ETH</p>`:''}<div class="card-actions">${active?`<button class="button outline" data-fund="${c.id}">Brew a contribution ✧</button>`:success&&!c.withdrawn&&mine?`<button class="button dark" data-withdraw="${c.id}">Harvest · withdraw ${eth(c.raised)} ETH</button>`:!success&&!active&&c.mine>0n?`<button class="button outline" data-refund="${c.id}">Reclaim essence · refund ↗</button>`:`<span class="settled">${c.withdrawn?'✓ Funds withdrawn':success?'✧ Awaiting the keeper’s harvest':'No refund available for this wallet'}</span>`}</div></div></article>`;
  }).join('')||`<div class="empty"><div class="empty-plants">${plantSVG(0)}</div><h3>An unwritten chapter.</h3><p>Plant a wish or explore another corner of the garden.</p></div>`;
}

async function connect() {
  injected = announced[0] || window.ethereum?.providers?.find(p=>p.isMetaMask) || (window.ethereum?.isMetaMask ? window.ethereum : null);
  if (!injected) throw new Error('MetaMask was not found. Open this website in Chrome with MetaMask installed, or in the MetaMask mobile browser.');
  await injected.request({method:'eth_requestAccounts'});
  const chain = await injected.request({method:'eth_chainId'});
  if (chain !== SEPOLIA) { await injected.request({method:'wallet_switchEthereumChain',params:[{chainId:SEPOLIA}]}); }
  provider = new BrowserProvider(injected);
  account = await (await provider.getSigner()).getAddress();
  $('#connect').textContent = short(account);
  $('#network-status').textContent = 'Connected to Sepolia';
  $('#wallet-address').textContent = account;
  $('#status-dot').classList.add('online');
  if (!injected._seedFundListeners) {
    injected.on('accountsChanged', () => location.reload());
    injected.on('chainChanged', () => location.reload());
    injected._seedFundListeners = true;
  }
  notice('Welcome to Arcana. Your wallet is connected to Sepolia. Only test ETH is used here.');
  await load();
}
async function verifyContract(candidate) {
  const code = await provider.getCode(candidate);
  if (code.toLowerCase() !== artifact.deployedBytecode.toLowerCase()) throw new Error('This address does not match the compiled SeedFund contract on Sepolia. Check the address or deploy this version.');
}
let loadedLimit = 12;
async function load() {
  const request = ++loadId;
  if (!provider || !address) { contract = null; render(); return; }
  try {
    await verifyContract(address);
    const next = new Contract(address, artifact.abi, provider);
    const count = Number(await next.campaignCount());
    const ids = Array.from({length: Math.min(count,loadedLimit)},(_,i)=>count-i-1);
    const result = await Promise.all(ids.map(async id => { const [c,mine] = await Promise.all([next.getCampaign(id),next.contributions(id,account)]); return {id,creator:c.creator,title:c.title,description:c.description,goal:c.goal,deadline:c.deadline,raised:c.raised,backers:c.backers,withdrawn:c.withdrawn,mine}; }));
    if (request !== loadId) return;
    contract = next; campaigns = result;
    $('#count').textContent = count;
    $('#raised').textContent = eth(result.reduce((a,c)=>a+c.raised,0n));
    $('#successful').textContent = result.filter(c=>c.raised>=c.goal).length;
    $('.stats div:nth-child(2) small').textContent = result.length<count ? 'ESSENCE · LOADED WISHES · TEST ETH' : 'ESSENCE CONTRIBUTED · TEST ETH';
    $('.stats div:nth-child(3) small').textContent = result.length<count ? 'BLOOMS · LOADED WISHES' : 'CELESTIAL BLOOMS';
    $('#more').hidden = count <= loadedLimit;
    render();
  } catch(e) { contract=null; campaigns=[]; render(); notice(errorText(e),true); }
}
async function transact(label, action, isDeploy=false, details={}) {
  if (busy) return;
  locked(true);
  let tx;
  try {
    if (!account) await connect();
    if (await injected.request({method:'eth_chainId'}) !== SEPOLIA) throw new Error('Switch MetaMask to Sepolia first.');
    const signer = await provider.getSigner();
    if (!isDeploy && !contract) throw new Error('Open Contract to deploy or select your garden first.');
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    notice(`${actionName(label)}: review and approve the transaction in MetaMask.`);
    tx = await action(signer);
    record(label,tx.hash,'Pending',details);
    notice(`${actionName(label)}: submitted. Waiting for Sepolia confirmation before updating the garden…`);
    let receipt;
    try { receipt = await tx.wait(); } catch(e) { if(e.code === 'TRANSACTION_REPLACED' && !e.cancelled) { record(label,tx.hash,'Replaced'); tx=e.replacement; receipt=e.receipt; } else throw e; }
    if (!receipt || receipt.status !== 1) throw new Error('Transaction reverted on-chain. The garden has not changed.');
    if (isDeploy) {
      address = receipt.contractAddress;
      localStorage.setItem('seedfund:address',address);
      localStorage.setItem('seedfund:deployment',JSON.stringify({chainId:11155111,address,transactionHash:receipt.hash}));
    }
    record(label,tx.hash,'Confirmed');
    notice(`${actionName(label)} confirmed in block ${receipt.blockNumber}. Find the receipt in your spellbook.`);
    await load();
    celebrate(label,details);
  } catch(e) { if(tx) record(label,tx.hash,e.code==='TRANSACTION_REPLACED'?'Cancelled / replaced':e.receipt?.status===0?'Reverted':'Unconfirmed · check explorer'); notice(errorText(e),true); }
  finally { locked(false); }
}
$('#connect').onclick = async () => { if(busy)return; locked(true); try { await connect(); } catch(e) { notice(errorText(e),true); } finally { locked(false); } };
$('#setup-open').onclick=()=>$('#setup-dialog').showModal();
$('#create-open').onclick=()=>$('#create-dialog').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#refresh').onclick=()=>load();
$('#more').onclick=()=>{ loadedLimit+=12; load(); };
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{ filter=b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b)); render(); });
$('#create-form').onsubmit=e=>{
  e.preventDefault();
  try {
    const f=e.target.elements,title=f.title.value.trim(),story=encodeStory(f.species.value,f.description.value);
    if(!title)throw new Error('Give your wish a name.');
    if(new TextEncoder().encode(title).length>80||new TextEncoder().encode(story).length>500)throw new Error('The title must fit 80 UTF-8 bytes and the story, including its species tag, 500 bytes. Please shorten your text.');
    const values=[title,story,parseEther(f.goal.value),Number(f.duration.value)];
    transact('Campaign created',s=>contract.connect(s).createCampaign(...values));
  } catch(e) {notice(errorText(e),true);}
};
$('#cards').onclick=e=> {
  const b=e.target.closest('button'); if(!b || busy)return;
  if(b.dataset.fund!==undefined){const c=campaigns.find(c=>c.id===Number(b.dataset.fund)); const f=$('#fund-form').elements; f.id.value=c.id; f.amount.value=eth(c.goal-c.raised<parseEther('0.001')?c.goal-c.raised:parseEther('0.001')); f.amount.max=eth(c.goal-c.raised); $('#fund-title').textContent=c.title; $('#fund-remaining').textContent=`${eth(c.goal-c.raised)} test ETH remains until this wish blooms.`; updateGrowthPreview(); $('#fund-dialog').showModal();}
  if(b.dataset.withdraw!==undefined)transact('Funds withdrawn',s=>contract.connect(s).withdraw(b.dataset.withdraw));
  if(b.dataset.refund!==undefined)transact('Refund claimed',s=>contract.connect(s).refund(b.dataset.refund));
};
$('#fund-form').onsubmit=e=>{
  e.preventDefault();
  try {const f=e.target.elements,id=f.id.value,value=parseEther(f.amount.value),potion=potionFor(value,f.infusion.value);
    transact('Campaign funded',s=>contract.connect(s).fund(id,{value}),false,{potion:potion.name,infusion:potion.infusion.adjective,amount:formatEther(value)});
  } catch(e) {notice(errorText(e),true);}
};
$('#deploy').onclick=()=>transact('Contract deployed',async s=>{const c=await new ContractFactory(artifact.abi,artifact.bytecode,s).deploy();return c.deploymentTransaction();},true);
$('#address-form').onsubmit=async e=>{e.preventDefault();try{const candidate=getAddress(e.target.elements.address.value.trim());if(!account)await connect();await verifyContract(candidate);address=candidate;localStorage.setItem('seedfund:address',address);$('#setup-dialog').close();await load();notice('Contract verified. Welcome to this garden.');}catch(e){notice(errorText(e),true);}};
$('#export').onclick=()=>{let record={chainId:11155111,address,transactionHash:''};try{const saved=JSON.parse(localStorage.getItem('seedfund:deployment'));if(saved?.address===address)record=saved;}catch{}const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='deployment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
render();
setInterval(()=>{if(contract&&!busy&&!document.querySelector('dialog[open]'))load();},20000);
