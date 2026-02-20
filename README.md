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

## Prototype Scope

- Address risk checks
- Privacy telemetry display
- Recent community reports
- Report payload preparation flow
- Wallet connection + onchain report submission
