# Arcana — deposit once, grow, choose when to withdraw

[Website](https://arcana.zliu05072.chatgpt.site) · [GitHub](https://github.com/zliu05072-prog/arcana)

Arcana is an English-language fantasy gardening prototype on Ethereum Sepolia. Players choose five magical seeds, grow flowers with potions, and sell blooms to Pip the pika. **Gameplay uses a persistent server balance. Only depositing and withdrawing require blockchain transactions.**

## Current deployment status

- Existing ARCA ERC-20 / V6 garden: [`0xc353a90e666E2C70279DC692FeEE7CB15AA8cB83`](https://sepolia.etherscan.io/address/0xc353a90e666E2C70279DC692FeEE7CB15AA8cB83), 18 decimals. This token is preserved.
- **New `ArcanaVault` settlement contract: awaiting operator deployment and activation.** The live site intentionally disables deposits/game purchases until verification succeeds. Do not present local tests as a completed Sepolia deployment.
- Existing wallet ARCA is not automatically moved, replaced or reset. Deposit it using one ordinary ERC-20 transfer to the activated vault. No allowance transaction is necessary.
- Existing V6 flowers remain at `/onchain.html`. That older garden still charges gas for its game writes. Its full documentation is in [docs/ONCHAIN-V6.md](docs/ONCHAIN-V6.md).

## Player flow

1. **Connect and sign in once.** A domain-bound, expiring wallet signature opens the saved game account. It is not a transaction, costs no gas and grants no token allowance. A seven-day HttpOnly session avoids gameplay signatures.
2. **Deposit existing ARCA** with `ARCA.transfer(vault, amount)` — one MetaMask transaction. Alternatively, `vault.depositEth()` purchases ARCA straight into escrow using Sepolia test ETH at 100,000 ARCA per ETH (0.0001–0.1 ETH per top-up).
3. **Select a free seed, buy a potion and grow.** The server debits only the game balance. The nine-second animation and all five species use the existing approved illustrations. No wallet calls occur during buying, growing or selling.
4. **Sell to Pip.** The reward goes into the game balance. The player can immediately buy another potion, retain the flower, leave the balance saved, or choose a withdrawal.
5. **Withdraw any available amount** with one MetaMask transaction. The remaining game balance stays spendable. A successful vault event plus an exact current-token Transfer event proves delivery to the same wallet. The page shows the receipt and independently reads the wallet balance. MetaMask's own token-list cache cannot be forced to refresh; Show ARCA uses `wallet_watchAsset` for this exact token.

Example: deposit 180 ARCA → buy a 60-ARCA potion → sell a Common flower for 40 → **160 game ARCA**. Withdraw 60 and keep 100, withdraw all 160, or keep playing. A deposit/play/withdraw session uses two player blockchain transactions regardless of how many flowers are grown in between.

## Economy

| Potion | Cost | Included site fee | Common 75% | Uncommon 20% | Rare 4% | Legendary 1% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Whisperdew Tonic | 60 | 6 | 40 | 60 | 150 | 400 |
| Moonwell Draught | 120 | 12 | 80 | 120 | 300 | 800 |
| Starfire Elixir | 240 | 24 | 160 | 240 | 600 | 1,600 |
| Phoenix Nectar | 480 | 48 | 320 | 480 | 1,200 | 3,200 |

All values are ARCA. The server reserves the maximum Legendary reward before accepting a purchase. If reserves are insufficient, the purchase stops without spending tokens; higher tiers may initially be unavailable. The 10% site fee is accounted separately and retained in escrow; this settlement release has no operator-fee payout endpoint. A 60-ARCA potion has nominal expected payout 52, site fee 6 and expected reserve gain 2. These are nominal outcomes, not guaranteed profit. ARCA has no promised cash value or ETH redemption.

## Architecture and trust

- **On-chain:** existing ARCA balances, deposit transfers, escrow holdings, ETH top-up/reserve events and single-use signed withdrawals.
- **Server / D1:** balances, purchased/growing/sold flowers, hidden mutation outcomes, game ledger, login sessions, idempotent operation receipts and reserved withdrawals.
- **Frontend:** selection, artwork and animation. Browser storage holds only retry/receipt metadata, never authoritative balances or flowers.
- `server/ledger.js` uses exact integer wei serialized as decimal strings. Atomic D1 batches and a global revision compare-and-swap commit treasury and account changes together. Concurrent spending, replayed deposits and duplicate sales cannot credit or debit twice.
- `server/worker.js` verifies wallet ownership; the client cannot select another user's account, choose its mutation or invent a deposit. Server cryptographic randomness fixes the mutation at purchase and hides it until growth completes. This is trusted-server randomness, **not** decentralized/verifiable randomness.
- `ArcanaVault.sol` accepts EIP-712 withdrawal vouchers from a fixed service authorizer. Claims are bound to wallet, amount, nonce, deadline, chain and vault. Only the named wallet can claim. Used nonces prevent replay. The operator has no arbitrary escrow withdrawal or signer-change function.
- Issuing a voucher moves the amount from spendable balance to pending. A declined wallet prompt does not immediately release it because the issued signature remains usable. Retry the same withdrawal, or recover it after its ten-minute deadline AND Sepolia finalized block have passed with its nonce still unused. A confirmed payment settles the pending debit.
- Deposits and payouts require two observed confirmations. This is a testnet confirmation policy, not protection against all chain reorganizations. Service availability and signer security are required; a compromised service signer could authorize malicious withdrawals. This prototype is not audited or suitable for real-value assets.
- The old V6 one-million-token reserve stays in its old contract and is not falsely counted as backing for the new game. The new vault must be funded independently.

## One-time activation

1. Configure a new server-only `ARCA_SIGNER_KEY` as a **secret** in Sites. Never use the user's MetaMask key, expose this key to the frontend, commit it, or rotate it after vault deployment without a migration plan. Production has its separate service secret configured.
2. The existing operator wallet `0x962189cAF0c97bd530611818b96Dc54242428a33` signs in on the website and opens **Operator · activate settlement**.
3. Review reserve funding (default **0.005 Sepolia ETH = 500 ARCA**) plus deployment gas, and confirm the one-time deployment in MetaMask. This setup payment is separate from normal player deposits, does not move existing wallet ARCA, and initially backs the basic potion. It is not a personal game credit.
4. The website checks successful deployment, exact runtime bytecode, token address, fixed service signer and operator, then atomically registers the vault and initial reserve in D1. The registration itself needs no wallet transaction. If the connection drops, use Register an already deployed vault with the saved address and transaction hash.
5. Only then perform a real deposit and withdrawal through the public website, record their hashes and submit the verified deployed vault address. Do not claim this step is complete before receipts exist.

Compilation: Solidity 0.8.30, optimizer 200 runs, Shanghai. Vault constructor arguments are the existing token and configured service authorizer. Standard JSON input: `public/vault-standard-input.json`; public source: `public/ArcanaVault.sol`.

## Local development

Node.js **24+** (tests use built-in SQLite), pnpm:

```sh
pnpm install --frozen-lockfile
pnpm compile
pnpm test
pnpm build
pnpm dev:full
```

`dev:full` applies local D1 migrations and serves the complete Worker/frontend at http://127.0.0.1:8787. `pnpm dev` runs Vite at 5173 and proxies `/api` to that local Worker for hot frontend edits. Do not use `vite preview` alone for this server-backed app. Local secrets, if needed, go in ignored `.dev.vars`; use a separate disposable signer for local chain tests. Never copy the production signer into a client bundle.

Schema is in `db/schema.ts`. Generate append-only migrations with `pnpm db:generate`, inspect the SQL, then build. `.openai/hosting.json` binds D1 `DB`; the build includes `dist/server/index.js`, `dist/client`, and migration metadata. Publish the existing Sites project; never create a replacement site/token to hide old balances.

## Validation and demonstration

44 tests cover retained contracts and wallet diagnostics plus new real ERC-20 deposit/payout transactions, no chain writes during gameplay, partial withdrawals, replay resistance, stolen/altered/expired vouchers, concurrent spending, insufficient reserves, rollback, login ownership, nonce replay and hidden mutations. Local tests do not prove live Sepolia completion.

For a seven-minute assessment: show token/vault addresses → connect and sign in → deposit (transaction 1) → choose a seed and grow with no wallet prompt → sell and show game credit → show both Continue/Withdraw choices → withdraw (transaction 2) → open the successful receipt, ARCA Transfer and wallet balance. Explain the off-chain gameplay / on-chain custody tradeoff.

Submission repository: https://github.com/zliu05072-prog/arcana. Add the **verified deployed vault address** after activation; do not submit a wallet address in its place.
