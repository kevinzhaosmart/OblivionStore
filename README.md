# Oblivion Store

Oblivion Store is an encrypted storefront where each wallet can name a shop, record inventory with fully homomorphic encryption (FHE), and decrypt quantities only when explicitly requested. It preserves inventory privacy on-chain while keeping the UX simple for store owners and viewers.

## Project Goals
- Allow anyone to create a named shop bound to their wallet.
- Store item quantities as encrypted `euint32` values so raw numbers never appear on-chain.
- Enable users to list inventory and decrypt quantities through the Zama relayer flow.
- Provide a full front-to-back path that is production-oriented (private-key deployment, Sepolia target, tested tasks).

## Problem It Solves
Traditional on-chain inventories expose business-sensitive data, such as stock levels, sales velocity, and supplier constraints. Oblivion Store keeps quantities private while still letting anyone verify that inventory exists and is managed on-chain. The result is a privacy-preserving storefront that protects business intelligence without sacrificing transparency or auditability.

## Key Advantages
- Privacy by default: quantities are encrypted end-to-end using FHE.
- On-chain integrity: updates are recorded on-chain without leaking plaintext.
- Explicit disclosure: decryption happens only after a user request and relayer approval.
- Clear ownership model: each shop belongs to a wallet; no shared mutable state.
- Production-aligned deployment flow: private key + RPC provider, no mnemonics.
- Frontend is real: no mock data, no local storage, all reads are on-chain.

## Technology Stack
- Smart contracts: Hardhat
- FHE stack: Zama FHEVM
- Relayer integration: Zama relayer SDK
- Frontend: React + Vite
- Blockchain clients: ethers (writes) + viem (reads)
- Package manager: npm

## Repository Structure
- `contracts` - FHE-enabled smart contracts
- `deploy` - deployment scripts
- `tasks` - Hardhat tasks for store operations
- `test` - unit tests
- `deployments` - generated deployment artifacts and ABIs
- `home` - React frontend (no Tailwind)

## How It Works
1. A user creates or renames a store that belongs to their wallet.
2. Item quantities are encrypted on the client and submitted on-chain as `euint32`.
3. Anyone can list the store items, but quantities remain encrypted.
4. When needed, a user requests decryption via the relayer flow and receives plaintext.

## Environment
Set these before deploying or running tests:
```bash
export PRIVATE_KEY=<wallet_private_key_without_0x>
export INFURA_API_KEY=<infura_project_id>
# optional
export ETHERSCAN_API_KEY=<etherscan_key>
```

## Contract Workflow
```bash
# Install dependencies
npm install

# Compile and run unit tests (mock FHEVM)
npm run compile
npm test

# Local deployment (for quick checks)
npx hardhat node
npx hardhat deploy --network localhost

# Sepolia deployment
npx hardhat deploy --network sepolia
# After deployment, copy the new address into:
# - deployments/sepolia/OblivionStore.json
# - home/src/config/contracts.ts
```

Custom tasks:
- `npx hardhat task:store-address` - print deployment address
- `npx hardhat task:create-store --name "My Shop"`
- `npx hardhat task:add-item --name "Item" --quantity 5`
- `npx hardhat task:decrypt-store` - read and decrypt stored quantities

## Frontend
The frontend lives in `home` and uses the ABI generated in `deployments/sepolia/OblivionStore.json`. Reads are done with viem and writes with ethers.

```bash
cd home
npm install
npm run dev
```

Set the Sepolia contract address in `home/src/config/contracts.ts` to enable interactions. The UI does not use local storage or local-only networks for data.

## Security and Privacy Notes
- Quantities are never stored in plaintext on-chain.
- Decryption requires explicit user action and relayer approval.
- View methods do not depend on `msg.sender`.
- Private keys are used for deployment; mnemonics are not supported.

## Testing
- Unit tests run against a mock FHEVM environment via Hardhat.
- Tasks can be used to validate end-to-end flows before Sepolia deployment.

## Roadmap
- Batch item updates to reduce gas usage.
- Richer item metadata (category, SKU, supplier tags) while keeping quantities private.
- UI audit history for inventory changes with encrypted diffs.
- Additional networks and relayer configurations.
- More robust analytics on encrypted data with privacy guarantees.

## Documentation
- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Relayer SDK guide](docs/zama_doc_relayer.md)
- [Solidity FHE guide](docs/zama_llm.md)
