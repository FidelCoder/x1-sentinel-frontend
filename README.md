# X1 Sentinel Frontend

Next.js + TypeScript prototype for the X1 Sentinel risk intelligence console.

## Quick Start

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

- `NEXT_PUBLIC_API_URL`: backend base URL (default expected: `http://localhost:4010`)
- `NEXT_PUBLIC_CHAIN_ID`: target chain id for wallet switch
- `NEXT_PUBLIC_CHAIN_NAME`: chain display name
- `NEXT_PUBLIC_CHAIN_CURRENCY_SYMBOL`: native token symbol
- `NEXT_PUBLIC_CHAIN_EXPLORER_URL`: optional explorer URL
- `NEXT_PUBLIC_RPC_URL`: RPC URL used for wallet network auto-add
- `NEXT_PUBLIC_CONTRACT_ADDRESS`: deployed registry contract address

## Current Testnet Deployment

- Network: `X1 EcoChain Testnet (Maculatus)`
- Chain ID: `10778`
- RPC: `https://maculatus-rpc.x1eco.com/`
- Explorer: `https://maculatus-scan.x1eco.com/`
- Contract (`X1SentinelRegistry`): `0xB36B20436b1D8f67CFbBF83D79F5C000E823418D`

Frontend env values should align with:

```bash
NEXT_PUBLIC_CHAIN_ID=10778
NEXT_PUBLIC_RPC_URL=https://maculatus-rpc.x1eco.com/
NEXT_PUBLIC_CHAIN_EXPLORER_URL=https://maculatus-scan.x1eco.com/
NEXT_PUBLIC_CONTRACT_ADDRESS=0xB36B20436b1D8f67CFbBF83D79F5C000E823418D
```

## Prototype Scope

- Address risk checks
- Privacy telemetry display
- Recent community reports
- Report payload preparation flow
- Wallet connection + onchain report submission
- Onchain voting and report resolution actions
- Transaction-status tracking (prepare, sign, submit, confirm, error)
