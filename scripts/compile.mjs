import solc from 'solc';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const input = {
  language: 'Solidity',
  sources: { 'SeedFund.sol': { content: readFileSync(new URL('../contracts/SeedFund.sol', import.meta.url), 'utf8') } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } }
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
for (const e of output.errors || []) console[e.severity === 'error' ? 'error' : 'warn'](e.formattedMessage);
if (output.errors?.some(e => e.severity === 'error')) process.exit(1);
const c = output.contracts['SeedFund.sol'].SeedFund;
mkdirSync(new URL('../src/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/contract.json', import.meta.url), JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object, deployedBytecode: '0x' + c.evm.deployedBytecode.object }, null, 2));
writeFileSync(new URL('../public/solidity-standard-input.json', import.meta.url), JSON.stringify(input, null, 2));
writeFileSync(new URL('../public/SeedFund.sol', import.meta.url), input.sources['SeedFund.sol'].content);
console.log('SeedFund compiled with ' + solc.version());

const gardenInput = {...input, sources: {'ArcanaGarden.sol': {content: readFileSync(new URL('../contracts/ArcanaGarden.sol', import.meta.url), 'utf8')}}};
const gardenOutput = JSON.parse(solc.compile(JSON.stringify(gardenInput)));
for (const e of gardenOutput.errors || []) console[e.severity === 'error' ? 'error' : 'warn'](e.formattedMessage);
if (gardenOutput.errors?.some(e => e.severity === 'error')) process.exit(1);
const garden = gardenOutput.contracts['ArcanaGarden.sol'].ArcanaGarden;
writeFileSync(new URL('../src/arcana-contract.json', import.meta.url), JSON.stringify({abi:garden.abi, bytecode:'0x'+garden.evm.bytecode.object, deployedBytecode:'0x'+garden.evm.deployedBytecode.object},null,2));
writeFileSync(new URL('../public/arcana-standard-input.json', import.meta.url),JSON.stringify(gardenInput,null,2));
writeFileSync(new URL('../public/ArcanaGarden.sol', import.meta.url),gardenInput.sources['ArcanaGarden.sol'].content);
console.log('ArcanaGarden + ARCA compiled with '+solc.version());

const vaultInput={...input,sources:{'ArcanaVault.sol':{content:readFileSync(new URL('../contracts/ArcanaVault.sol',import.meta.url),'utf8')}}};
const vaultOutput=JSON.parse(solc.compile(JSON.stringify(vaultInput)));
for(const e of vaultOutput.errors||[])console[e.severity==='error'?'error':'warn'](e.formattedMessage);
if(vaultOutput.errors?.some(e=>e.severity==='error'))process.exit(1);
const vault=vaultOutput.contracts['ArcanaVault.sol'].ArcanaVault;
writeFileSync(new URL('../src/vault-contract.json',import.meta.url),JSON.stringify({abi:vault.abi,bytecode:'0x'+vault.evm.bytecode.object,deployedBytecode:'0x'+vault.evm.deployedBytecode.object},null,2));
writeFileSync(new URL('../public/ArcanaVault.sol',import.meta.url),vaultInput.sources['ArcanaVault.sol'].content);
writeFileSync(new URL('../public/vault-standard-input.json',import.meta.url),JSON.stringify(vaultInput,null,2));
console.log('ArcanaVault compiled with '+solc.version());
