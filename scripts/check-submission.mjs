import { readFileSync } from 'node:fs';
import { getAddress, Interface } from 'ethers';

// Read-only checks: this script never needs a wallet or private key.
const deployment = JSON.parse(readFileSync(new URL('../src/arcana-deployment.json', import.meta.url)));
const artifact = JSON.parse(readFileSync(new URL('../src/arcana-contract.json', import.meta.url)));
const abi = new Interface(artifact.abi);

async function rpc(method, params) {
  const response = await fetch(process.env.SEPOLIA_RPC_URL, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}.`);
  const body = await response.json();
  if (body.error || !('result' in body)) throw new Error(`RPC failed for ${method}.`);
  return body.result;
}

async function check() {
  if (!deployment.address) throw new Error('Deploy through Contract → Deploy ArcanaGarden, then save the downloaded record as src/arcana-deployment.json.');
  const address = getAddress(deployment.address);
  if (deployment.chainId !== 11155111) throw new Error('Deployment record must specify Sepolia (11155111).');
  if (!process.env.SEPOLIA_RPC_URL) throw new Error('Set SEPOLIA_RPC_URL to an Ethereum Sepolia JSON-RPC endpoint.');
  const repo = process.env.GITHUB_REPOSITORY_URL || '';
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repo)) throw new Error('Set GITHUB_REPOSITORY_URL to your actual repository URL.');
  const hashes = (process.env.DEMO_TRANSACTION_HASHES || '').split(',').map(s => s.trim()).filter(Boolean);
  if (new Set(hashes.map(h => h.toLowerCase())).size < 2 || hashes.some(h => !/^0x[\da-f]{64}$/i.test(h))) {
    throw new Error('Set DEMO_TRANSACTION_HASHES to at least two distinct website transaction hashes, separated by commas.');
  }
  if (BigInt(await rpc('eth_chainId', [])) !== 11155111n) throw new Error('RPC endpoint is not Sepolia.');
  if ((await rpc('eth_getCode', [address, 'latest'])).toLowerCase() !== artifact.deployedBytecode.toLowerCase()) {
    throw new Error('Deployed runtime bytecode does not match this project.');
  }
  for (const hash of hashes) {
    const [receipt, tx] = await Promise.all([
      rpc('eth_getTransactionReceipt', [hash]), rpc('eth_getTransactionByHash', [hash]),
    ]);
    if (!receipt || receipt.status !== '0x1' || receipt.to?.toLowerCase() !== address.toLowerCase()) {
      throw new Error(`Transaction ${hash} must be confirmed, successful, and addressed to this contract.`);
    }
    const call = tx && abi.parseTransaction({ data: tx.input, value: tx.value });
    if (!call || !['growFlowers', 'growFromSatchel', 'sellAndClaim', 'buyArca', 'claimStarter', 'plantSeed', 'buyPotions', 'waterFlower', 'sellToPip', 'claimPetals', 'revealBloom'].includes(call.name)) {
      throw new Error(`Transaction ${hash} is not a supported Arcana garden action.`);
    }
    console.log(`Confirmed ${call.name}: https://sepolia.etherscan.io/tx/${hash}`);
  }
  console.log('\nSepolia bytecode and interaction receipts verified.');
  console.log('Manually confirm the GitHub URL is accessible and contains the complete source.');
  console.log('Receipts prove on-chain execution; rehearse the website and MetaMask flow separately.');
  console.log(`\n1. GitHub Repository: ${repo}\n2. Smart Contract Address: ${address}`);
}

check().catch(error => {
  console.error(`Submission not ready: ${error.message}`);
  process.exitCode = 1;
});
