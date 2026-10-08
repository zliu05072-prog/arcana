# Arcana — Pip’s Moonlight Market (V6)

[Live website](https://arcana.zliu05072.chatgpt.site) · [GitHub repository](https://github.com/zliu05072-prog/arcana)

**Sepolia garden and ARCA token:** `0xc353a90e666E2C70279DC692FeEE7CB15AA8cB83`

An English-language fantasy gardening DApp on Ethereum Sepolia. Choose one of five magical seeds and a potion for free, then start growing with **Arcana Petals (ARCA)** in one transaction. Sell a mature flower to Pip the illustrated pika merchant in a second transaction that pays ARCA directly to the connected wallet.

**Deployment status:** V6 is deployed on Ethereum Sepolia at [`0xc353a90e666E2C70279DC692FeEE7CB15AA8cB83`](https://sepolia.etherscan.io/address/0xc353a90e666E2C70279DC692FeEE7CB15AA8cB83). Deployment [receipt](https://sepolia.etherscan.io/tx/0x3a27d5ec36da54a1fa15eaafed81b853c23baba4d44763bdf36dfe7cb72514d4) confirmed in block 11854745; the connected application verified exact runtime bytecode. `src/arcana-deployment.json` fixes this shared deployment for all visitors. The V6 grow/sell flow has passed local tests; two live demonstration transactions must still be verified for assessment.

## Run locally

Requires Node.js 20.19+ and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

Open Vite's local URL, usually http://127.0.0.1:5173. Use Chrome with MetaMask for live wallet interactions. **Practice realm** supports the whole game with clearly labelled simulated balances; it creates no blockchain receipts and does not count toward assessment. Practice progress resets on reload.

## Deploy V6 through MetaMask

1. Open the website in a MetaMask-enabled browser. Select **Connect Wallet** and Ethereum **Sepolia**. The wallet needs Sepolia test ETH for deployment and transaction gas.
2. Open **Contract**, select **Deploy ArcanaGarden V6**, and continue to MetaMask. Review and confirm the deployment there.
3. The deploying wallet becomes the site fee operator. Wait for a confirmed receipt. The same contract address provides the garden and ERC-20 ARCA token. The application checks the exact compiled runtime bytecode.
4. Select **Download deployment record**. Save it as `src/arcana-deployment.json`, then rebuild and republish so all visitors use this deployment. An address only saved in browser storage is local to that browser and origin.
5. An existing V6 address can also be entered in Contract. V1/V2/V3/V4/V5 and legacy SeedFund addresses are intentionally rejected because the rules and ABI changed. Old deployments are not upgraded or migrated automatically.
6. Select **Add ARCA to MetaMask**, or import the token manually on Sepolia using the garden address, symbol `ARCA`, and 18 decimals.

The constructor accepts Sepolia (11155111) and local test chains (1337/31337) only. No private key is stored in the project. ARCA is a test game token, not cash.

## Exchange Sepolia ETH for ARCA

Use **Get ARCA → Exchange ETH for ARCA** before visiting the potion shop. This is a fixed-rate, one-way purchase of test game tokens:

- **0.001 Sepolia ETH = 100 ARCA** (1 ETH = 100,000 ARCA).
- Presets: 0.0006 ETH for 60 ARCA, 0.001 for 100, and 0.005 for 500.
- Per transaction: 0.0001–0.1 Sepolia ETH inclusive. Quotes use exact integer wei, with no floating-point conversion.
- No exchange fee. MetaMask separately charges network gas; leave some test ETH in the wallet for that gas and later transactions.
- `buyArca(minimumArca)` receives native Sepolia ETH and issues ARCA only to the caller. The transaction either succeeds with the payment and tokens together or reverts. A minimum-output argument protects the displayed quote.
- Paid ARCA goes directly to the MetaMask token balance and can immediately buy potions once confirmed. The separate 100-ARCA starter grant remains optional.
- **This is not a two-way swap:** ARCA cannot be redeemed for ETH or cash. Flower earnings are withdrawn as ARCA. Direct ETH transfers without the exchange function are rejected.
- Exchange receipts are held separately from ARCA reserves. Only the deploying operator can collect recorded test ETH using `claimEthRevenue(amount)`. The page shows available exchange receipts and the operator-only collection button. Failed transfers revert the accounting, and ETH collection is protected against re-entry.
- Practice mode starts with 0.1 simulated ETH; exchange and potion transactions in this mode do not touch any wallet or blockchain.

## The complete game loop

1. **Get ARCA:** exchange Sepolia test ETH or optionally claim the one-time 100-ARCA starter grant. These are separate transactions before playing.
2. **Choose freely:** select any of the five seeds and a potion recipe. Selection and the “Choose potion” button do not connect a wallet, create a transaction or cost gas.
3. **Start growing:** one `growFlowers(species,tier,infusion,quantity)` transaction buys 1–20 potions, plants that many seeds and waters them atomically. No separate allowance, planting or watering confirmation is needed. The ARCA price includes a 10% site fee; 90% funds buybacks. Each bottle locks its maximum legendary payout. Failure reverts the entire batch.
4. **Watch growth:** the live bloom becomes available three blocks after watering. Practice mode takes nine seconds. Optional preservation is still a separate transaction if keeping a mutation permanently.
5. **Sell and receive:** `sellAndClaim(id,minimumReward)` marks the flower sold and transfers its full price to the wallet in the same transaction. No separate withdrawal is required. The transaction receipt contains an ERC-20 Transfer event. Any pre-existing unclaimed credits remain untouched.

Only on-chain writes require Sepolia gas. A normal grow-and-sell cycle takes two transactions after acquiring ARCA. Pending, rejected or reverted transactions do not fabricate success. The latest full transaction hash and explorer link appear prominently above the garden; history is in the spellbook. Practice receipts are never presented as on-chain transactions.

Advanced compatibility methods remain available in the contract: separate potion purchases, planting, watering, selling to credits and partial withdrawals. `growFromSatchel` plants and waters with an already purchased bottle without charging ARCA again.

### Previous V5 garden

The preserved `/previous/` website accesses the prior contract. Its confirmed address is `0x8E3d5bFc19DcBe4b7352A53b520351c2Fe0B9112`; its deployment receipt is recorded in `docs/previous-deployment.json`. V5 and V6 are different token contracts despite sharing the ARCA symbol. Existing tokens, bottles and flowers stay in V5; they are not automatically migrated or deleted. The previous UI retains its original separate sale and withdrawal flow.

## Wallet balance and transaction proof

The wallet panel appears at the top of the site. It shows the connected address, the on-chain ARCA balance and the Sepolia block used for that balance. Add ARCA to MetaMask imports the same configured token address; it does not transfer or create tokens.

Every new transaction has distinct approval, pending and confirmed states. A successful receipt is decoded for ERC-20 Transfer events emitted by the configured ARCA contract and involving the connected wallet. The panel shows tokens received/spent, full transaction hash, destination wallet, confirmation block and ETH gas fee separately. Rejected/reverted/pending transactions do not count as payments. Receipts are saved locally and up to five recent incoming payments are recovered from the last 2,000 Sepolia blocks on connect or balance refresh. Each recovered payment is checked against its successful receipt and the exact token and wallet. A manual transaction-hash checker handles older payments and smart-account batched transactions without assuming the outer transaction targets the token. View ARCA transfers on Etherscan shows the complete public token history. A failed live refresh displays an unavailable balance instead of claiming a successful refresh.

The petal purse separates ARCA from Sepolia ETH, shows the full current token address, and provides a read-only wallet and payment checker even without MetaMask. It reads the independent publicnode Sepolia endpoint and, when available, the selected MetaMask connection at the same explicit block. It distinguishes wrong-network, wrong-account, differing balances, and unavailable checks. This checks the wallet RPC, not the extension’s visible token-list cache, and cannot force-refresh MetaMask itself. New in-session receipts also show before/after wallet snapshots separately from the transaction’s verified transfer amount.

The deployed contract is unchanged by this interface update; no redeployment or token migration is needed.

## Potion shop

| Potion | Price | Included site fee | Common | Uncommon | Rare | Legendary |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Whisperdew Tonic | 60 | 6 | 40 | 60 | 150 | 400 |
| Moonwell Draught | 120 | 12 | 80 | 120 | 300 | 800 |
| Starfire Elixir | 240 | 24 | 160 | 240 | 600 | 1,600 |
| Phoenix Nectar | 480 | 48 | 320 | 480 | 1,200 | 3,200 |

All figures are ARCA. The 10% site fee is already included in the purchase price; sales and player withdrawals have no additional protocol fee. Network gas is separate. A basic potion costs 60: a common flower returns 40 (a loss of 20), an uncommon returns 60, a rare returns 150, and a legendary returns 400. Under nominal probabilities, the average buyback is 52: the operator earns 6, and the pool retains an expected 2 of its 54 contribution. Outcomes and long-run margins are not guaranteed.

Infusions: **Moon Salt**, **Ember Dust**, **Dream Pollen**. Infusion is stored with the flower and changes potion presentation. Potion strength increases the sale offer, not rarity odds. Potions are paid in ARCA. Sepolia ETH can buy ARCA through the exchange and is also needed for network gas; potion purchases themselves carry no ETH payment.

| Rarity | Nominal chance | Offer multiplier | Visual change |
| --- | ---: | ---: | --- |
| Common | 75% | 1× | Original mature flower |
| Uncommon | 20% | 1.5× | Alternate colours, same species shape |
| Rare | 4% | 3.75× | New petal geometry and silhouette |
| Legendary | 1% | 10× | Distinct magical evolved form |

| Seed | Common | Uncommon | Rare | Legendary |
| --- | --- | --- | --- | --- |
| Moonveil | Moonveil Lily | Jadeglass Lily | Amethyst Eclipse | Crown of Selene |
| Emberthorn | Emberthorn Rose | Frostfire Rose | Dragonheart Rose | Phoenix Coronation |
| Astral | Astral Starcap | Aurora Starcap | Nebula Cluster | Worldstar Mycelium |
| Crystal | Crystal Bellflower | Peachbell Blossom | Crystal Chime | Frostlight Cathedral |
| Sunwhisper | Sunwhisper Sunflower | Lavender Sunflower | Clockwork Sun | Dawn Sovereign |

The herbarium displays all approved seed/flower sheets as a field guide, not as the user's inventory. Pip and the twenty mature forms share a flat, geometric storybook style. Original generated artwork and prompts are documented in `docs/APPROVED-ART.md`.

## Why blockchain and what is on-chain

`contracts/ArcanaGarden.sol` combines a gardening state machine and ERC-20 token. Public state records seed species, keeper, planted block, potion inventory, watering status, infusion, tier, reveal block, preserved rarity, sold status, starter eligibility, garden credits, token balances, total supply and allowances. Ownership, single-sale rules and token transfers are enforced independently of the website. Artwork, animation, English names and interface are off-chain.

Flowers are non-transferable game records, not NFTs. There is no upgrade authority or external game backend. The deploying wallet is the operator, allowed to withdraw only accumulated 10% site fees using `claimSiteRevenue(amount)`. It can also collect recorded Sepolia ETH exchange receipts. It cannot withdraw the ARCA buyback reserve or player credits, alter prices or probabilities, or mint arbitrary tokens.

The constructor creates **1,000,000 test ARCA** in the contract as initial buyback inventory. This is not real funding, paid-in capital or earned revenue. One-time starter grants and paid ETH-to-ARCA purchases also mint tokens. Potion purchases and flower sales do not mint or burn tokens. Each purchased bottle reserves its full legendary payout until the corresponding flower is sold. Sale removes the actual reward from `poolReserve`, releases that bottle’s maximum commitment from `reservedRewards`, and credits `claimable`; player withdrawal transfers the exact amount and reduces `totalClaims`. The accounting invariant is `contract balance >= poolReserve + siteRevenue + totalClaims` (equality absent unsolicited transfers), with `poolReserve >= reservedRewards`. A sale can always pay an accepted bottle's quote from its protected reserve, even after operator fees are withdrawn.

Anyone can add their existing ARCA using `fundReserve(amount)`; this creates no supply and no fee. Direct token transfers to the contract are not credited as reserve deposits; use the explicit function. Keeping bottles or flowers unsold keeps the conservative maximum reservation locked. New purchases stop when the uncommitted reserve cannot cover the added obligation. The website's market ledger shows accumulated site fees, withdrawable site fees, total pool inventory and reserved obligations. The fee-withdrawal button appears only for the operator wallet.

### Mutation design

Watering in block N commits to block N+2. From N+3, `previewBloom` reads `keccak256(abi.encode(blockhash(N+2), flowerId, keeper, contractAddress, chainId)) % 10000`; thresholds are 7500 / 9500 / 9900. Refreshing cannot reroll a flower. `revealBloom` lets anyone preserve the same outcome; keeper-only selling also preserves it.

This is prototype entropy, not secure verifiable randomness. Validators can influence block hashes, so the percentages describe nominal uniform-roll odds, not a guarantee of fairness. An unpreserved outcome expires after the 256-block hash window and becomes Common. Preserving it keeps it permanently. Sales include a minimum accepted reward to prevent an expired quote silently receiving a lower payout. A valuable-asset deployment would require stronger randomness and independent security review.

### Game economy limits

ARCA has no cash redemption, ETH redemption, guaranteed resale rate or promised value. Supply is uncapped because each new wallet can claim a starter grant and players can buy ARCA with test ETH; flower sales do not create tokens. A starter grant is limited per address, not per person; multiple wallets can collect multiple grants. Common flowers sell below cost. The displayed nominal average return does not guarantee profit, and the per-wallet grant is not Sybil-resistant. Initial minted reserves and free grants mean this is a classroom token economy, not evidence of real commercial profitability. Wallet withdrawal means an ERC-20 transfer on Sepolia, not real-money withdrawal. Network gas is required for each write.

## Tests and verification

`pnpm test` runs **35 tests**: 17 V6 contract tests, 2 receipt-verification tests, 6 wallet-diagnostic tests and 10 retained legacy tests. V6 coverage includes one-time starter grants, all five seeds, exact potion prices, purchase limits, inventory isolation, watering ownership, fixed delayed outcomes, all reward/rarity boundaries, preservation and expiry, atomic batch growth, direct sale payouts, previously purchased bottle growth, sale replay prevention, partial withdrawals, reserve accounting, 10/90 purchase allocation, operator-only fee withdrawals, reserve exhaustion, no minting on sales, ERC-20 balances/allowances/transfers, exact exchange quotes, ETH payment/output atomicity, operator-only ETH collection, and rollback after failed ETH transfers. These are local Ganache tests, not evidence of a real Sepolia deployment.

Compile with Solidity **0.8.30**, optimizer enabled / 200 runs, EVM Shanghai, no constructor arguments. For Etherscan verification use `public/arcana-standard-input.json` as Solidity standard JSON input, selecting `ArcanaGarden`.

After deployment and real transactions:

```sh
SEPOLIA_RPC_URL='https://YOUR_RPC' \
GITHUB_REPOSITORY_URL='https://github.com/YOUR_NAME/YOUR_REPO' \
DEMO_TRANSACTION_HASHES='0xFIRST_HASH,0xSECOND_HASH' \
pnpm check:submission
```

The read-only check verifies chain ID, exact V6 runtime bytecode, successful receipts and recognized game calls. Do not commit RPC secrets. Submit the GitHub repository URL and deployed contract address, not the personal wallet address or website URL.

## Seven-minute demonstration

Preflight: deploy and publish the shared contract record, connect a funded Sepolia wallet, exchange a small amount of test ETH for ARCA, and prepare one mature flower so waiting for blocks does not consume the demonstration.

- 0:00–1:00: introduce Pip, five seed species and the herbarium; show the connected wallet and Sepolia contract.
- 1:00–2:00: choose a seed and potion freely; show that no wallet confirmation is requested.
- 2:00–3:00: start growing, confirm once in MetaMask, and show the full receipt and reduced ARCA balance.
- 3:00–4:00: show the growth animation and explain rarity while awaiting blocks.
- 4:00–5:00: sell the new or prepared flower and confirm once in MetaMask.
- 5:00–6:00: show the increased ARCA wallet balance and Transfer event in that sale receipt; no withdrawal is needed.
- 6:00–7:00: open the deployed Solidity contract and explain on-chain data, testnet economy and randomness limitations.

## Source map and publishing

- `contracts/ArcanaGarden.sol`: V6 garden and ERC-20 contract.
- `src/game.js`, `src/game-page.js`: current English application and wallet flow.
- `src/game.css`, `src/garden-v3.css`: layout, responsive styles and growth animations, including reduced-motion support.
- `src/world.js`: five species, twenty forms, prices and approved-art viewports.
- `public/art/`: approved Pip and five botanical sheets.
- `src/arcana-contract.json`: generated ABI and bytecode.
- `src/arcana-deployment.json`: shared Sepolia deployment record, once confirmed.
- `docs/LEGACY-CROWDFUNDING.md`: archived SeedFund design. Its contract, entry point and tests are retained but not loaded by the website.

The Sites project is linked in `.openai/hosting.json`. Publish the generated `dist/` after `pnpm build`. For manual static hosting, upload the contents of `dist`, not the source tree. MetaMask requires HTTPS or localhost. Rebuild and republish after saving the confirmed shared deployment record.
