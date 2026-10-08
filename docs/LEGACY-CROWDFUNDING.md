# Arcana — The Enchanted Conservatory

An English-language fantasy crowdfunding DApp on Ethereum Sepolia. Plant a magical species, turn a test ETH contribution into a named potion, and watch on-chain funding awaken your plant. The existing `SeedFund.sol` escrow rules and deployment compatibility are preserved.

## Plants, potions and practice

- **Moonveil Lily:** silver-veined petals from the Lunar Archive.
- **Emberthorn Rose:** a dragon-born flower from the Ashen Highlands.
- **Astral Starcap:** luminous mushrooms from the Dreaming Woods.

Choose the species while planting a wish. A validated `[Arcana:species]` tag is stored inside the existing on-chain description; the interface separates it from the story. Untagged legacy campaigns remain supported and receive a visual species based on their ID. No new contract deployment is required merely for this interface update.

| Contribution in test ETH | Potion | Rank |
| --- | --- | --- |
| Greater than 0, below 0.0005 | Whisperdew Tonic | Apprentice |
| 0.0005 to below 0.001 | Moonwell Draught | Adept |
| 0.001 to below 0.002 | Starfire Elixir | Enchanter |
| 0.002 and above | Phoenix Nectar | Master |

The amount is compared in integer wei, so boundary amounts are exact. Add **Moon Salt**, **Ember Dust**, or **Dream Pollen** for a cosmetic infusion and vial color. These are visual recipes, not purchased items, tokens or NFTs. Infusions do not multiply funding or growth. Potion names are derived from the submitted amount; recipe details are included in this browser's local transaction history.

The **Alchemy desk** is an explicitly off-chain practice area. Change the amount and ingredient to see the recipe update, choose a specimen, then select **Brew & cast · practice**. Its goal is 0.005 test ETH in simulated contributions; it never requests a wallet or sends a transaction. Switching species or selecting **Reset specimen** starts fresh. Practice actions do not count toward the assessment's two required blockchain transactions.

Real campaigns use **Plant a wish → Brew a contribution → Cast potion · approve in MetaMask**. Growth updates from the contract after confirmation: 0% dormant, greater than 0 to below 25% awakening, 25% to below 75% foliage, 75% to below 100% gathering magic, and 100% bloom. Goals cap contributions exactly. At success, the creator can harvest (withdraw); after an unsuccessful deadline, contributors can reclaim essence (refund).

The contract stores and protects test ETH under public rules; it does not assess project quality or control the creator's use of funds after withdrawal.

## Deployment status

The source is implemented. **A Sepolia deployment and GitHub repository must be created before submission.** An empty `src/deployment.json` is intentional: no fabricated contract address or simulated transaction is presented as live.

## Run locally

Requires Node.js 22 or newer, pnpm (or npm), and a browser with MetaMask.

```sh
pnpm install
pnpm run compile
pnpm test
pnpm dev
```

Open the local URL shown by Vite in Chrome with MetaMask installed. `pnpm build` creates static output in `dist`; `pnpm preview` serves the build. npm equivalents work too (`npm install`, `npm run compile`, `npm test`, `npm run dev`). Commit the lockfile for your selected package manager.

## Deploy to Sepolia — no private-key export

1. Unlock MetaMask and enable the Sepolia test network. Acquire Sepolia test ETH from a faucet linked by [Ethereum's network documentation](https://ethereum.org/en/developers/docs/networks/#sepolia). Test ETH has no real monetary value.
2. Click **Connect Wallet**. Approve connection and the switch to Sepolia if requested. The full connected wallet address appears beneath the hero.
3. Click **Contract → Deploy garden contract**. Review the deployment transaction in MetaMask and confirm.
4. Wait for the confirmed receipt. The app saves the resulting address locally and starts reading that contract. **View Sepolia contract** opens the Sepolia Etherscan page.
5. Open Contract again and download the deployment record. Replace `src/deployment.json` with that file, then rebuild. This makes the chosen contract the default for other users and browsers. A browser's explicitly selected address takes precedence.
6. A second browser can select the same address using **Enter this garden**. The app compares the deployed runtime bytecode with the compiled artifact before interacting.

Never commit a seed phrase or private key. The public contract address is safe to commit. Browser storage contains only public contract/transaction records. Campaign information, including descriptions, is public on-chain.

### Source verification

Deployment and source verification are separate. On the contract's Sepolia Etherscan page select **Contract → Verify and Publish**, choose Solidity Standard JSON Input, compiler **v0.8.30+commit.73712a01**, MIT license, and upload `public/solidity-standard-input.json`. It includes optimizer enabled (200 runs) and Shanghai EVM target. There are no constructor arguments. Verification is done only when Etherscan reports success.

## Seven-minute demonstration

| Time | Action |
| --- | --- |
| 0:00–0:45 | Open Arcana. Explain that funds are held by contract rules, not a platform operator. |
| 0:45–1:15 | Connect MetaMask, show Sepolia and the full wallet address. |
| 1:15–2:45 | **Transaction 1:** use **Plant a wish** to create “A sanctuary for midnight readers”, goal `0.001` test ETH, duration one day. Approve in MetaMask. Wait for confirmation; show the seedling and spellbook receipt. |
| 2:45–4:15 | **Transaction 2:** use **Brew a contribution** and cast a potion with `0.001` test ETH. Approve and wait. Show the progress reaching 100% and the blooming plant. The creator is allowed to self-fund for a one-wallet demo; another wallet better illustrates independent backers. |
| 4:15–5:15 | Optional **transaction 3:** withdraw as the creator. Show the paid-out status and Etherscan receipt. |
| 5:15–6:00 | Open View Sepolia contract to show the actual Sepolia address and verified Solidity source. |
| 6:00–7:00 | Explain on-chain data, refund rules, checks before transfers, and limitations. |

Deploy before the assessment, keep extra test ETH for gas, rehearse in the same browser, and allow for network delays. Deployment does not replace the two website interaction transactions. For a refund demo: create a one-minute campaign, partially fund it, wait for expiry, refresh, and claim the refund.

## Design and Q&A

- **Why blockchain?** An independently inspectable escrow enforces success and refund conditions, with publicly verifiable transaction receipts. It avoids giving a website operator custody of campaign funds.
- **On-chain data:** creator, title and description, goal, deadline, gross amount raised, unique backer count, withdrawal flag, and each backer's contribution. Events record creation, funding, withdrawal, and refunds.
- **Off-chain data:** website layout and local receipt history. The app does not claim browser history is a global index of all transactions.
- **Success:** funding is capped exactly at the goal. Once reached, funding closes and only the creator can withdraw, even before the deadline. Success cannot become failure later.
- **Failure:** below the goal at the deadline, each backer can reclaim their contribution. Gas fees are not refunded. `raised` remains historical, while the claimant's refundable balance is zeroed.
- **Safety:** Solidity 0.8 checked arithmetic; bounded text and duration; nonzero values; creator-only, one-time withdrawals; checks-effects-interactions and a reentrancy lock on ETH payouts; no unbounded payout loops; no admin or upgrade privilege. Rejecting recipients do not block other backers' refunds.
- **Limitations:** unaudited educational prototype; public data; gas costs; variable confirmation time; no identity checks, project vetting, or guarantee of use of withdrawn funds; immutable campaign terms; manual refund claims; a recipient contract that rejects ETH cannot receive its payout. This is not a production investment platform.
- **Scale:** the UI reads the latest 12 campaigns, with Load earlier campaigns. Statistics identify when they cover only loaded campaigns. A production version would use an event indexer and independent RPC reads. Here a connected wallet supplies reads and writes.
- **MetaMask:** injected provider discovery supports EIP-6963 and the legacy MetaMask provider, account/chain change handling, request rejection, confirmation receipts and wrong-network prevention. Desktop MetaMask or its mobile browser is required; remote-wallet QR pairing is outside scope.

## Repository contents

- `contracts/SeedFund.sol`: complete Solidity contract.
- `src/main.js`, `src/page.js`, `src/style.css`, `src/arcana.css`: frontend and MetaMask integration using ethers v6.
- `src/garden.js`: species, growth projections, SVG botanical illustrations, potion tiers and infusion recipes.
- `test/garden.test.mjs`: exact growth/tier boundaries, species metadata and cosmetic-infusion invariants.
- `src/contract.json`: generated ABI, creation bytecode and deployed bytecode.
- `src/deployment.json`: shared public Sepolia deployment configuration.
- `scripts/compile.mjs`: reproducible compilation with pinned solc.
- `test/contract.test.mjs`: local EVM tests for creation, funding, access control, payouts, expiry, refunds and isolation.
- `public/solidity-standard-input.json`: Etherscan verification input.

## Publish and submit

Create an empty GitHub repository, then from this directory:

```sh
git init
git add .
git commit -m "Build SeedFund Sepolia crowdfunding DApp"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/seedfund-dapp.git
git push -u origin main
```

The website can be demonstrated locally. To host it on a static host, build and deploy `dist/` after saving the deployment address. Vite's default root base assumes root-domain hosting; for GitHub Pages project hosting, configure the repository subpath as the Vite base.

Submission (replace both placeholders with real values after deployment):

```text
1. GitHub Repository: https://github.com/YOUR_USERNAME/seedfund-dapp
2. Smart Contract Address: YOUR_ACTUAL_SEPOLIA_CONTRACT_ADDRESS
```

Before submitting, save the deployment record and run the read-only submission check:

```sh
SEPOLIA_RPC_URL='https://YOUR_SEPOLIA_RPC_ENDPOINT' \
GITHUB_REPOSITORY_URL='https://github.com/YOUR_USERNAME/seedfund-dapp' \
DEMO_TRANSACTION_HASHES='0xFIRST_TRANSACTION_HASH,0xSECOND_TRANSACTION_HASH' \
pnpm run check:submission
```

It checks the network, exact deployed runtime bytecode, and at least two distinct successful campaign interaction receipts, then prints the two submission lines. Deployment transactions do not qualify as campaign interactions. It does not verify repository access, source verification on Etherscan, or whether the transactions were initiated through the website; check these during rehearsal. No private key is required.

## Technical references

- [Solidity security considerations](https://docs.soliditylang.org/en/latest/security-considerations.html)
- [MetaMask Ethereum provider API](https://docs.metamask.io/wallet/reference/provider-api/)
- [ethers v6 documentation](https://docs.ethers.org/v6/)
