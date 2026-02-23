# X1 Sentinel Frontend

Next.js + TypeScript prototype for the X1 Sentinel risk intelligence console.

## Quick Start

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

1. Import this repo in Vercel.
2. Keep root directory as `./`.
3. Set environment variables from `.env.local.example` and set `NEXT_PUBLIC_API_URL` to your deployed backend URL.
4. Deploy.

## Environment

- `NEXT_PUBLIC_API_URL`: backend base URL (default expected: `http://localhost:4010`)
- `NEXT_PUBLIC_CHAIN_ID`: target chain id for wallet switch
- `NEXT_PUBLIC_CHAIN_NAME`: chain display name
- `NEXT_PUBLIC_CHAIN_CURRENCY_SYMBOL`: native token symbol
- `NEXT_PUBLIC_CHAIN_EXPLORER_URL`: optional explorer URL
- `NEXT_PUBLIC_RPC_URL`: RPC URL used for wallet network auto-add
- `NEXT_PUBLIC_CONTRACT_ADDRESS`: deployed registry contract address
- `NEXT_PUBLIC_AI_DECISION_ANCHOR_ADDRESS`: optional AI anchor contract address override
- `NEXT_PUBLIC_DEPIN_ANCHOR_ADDRESS`: optional DePIN anchor contract address override

## Current Testnet Deployment

- Network: `X1 EcoChain Testnet (Maculatus)`
- Chain ID: `10778`
- RPC: `https://maculatus-rpc.x1eco.com/`
- Explorer: `https://maculatus-scan.x1eco.com/`
- Contract (`X1SentinelRegistry`): `0x5C4Be8d3fF603cba1A25dB2D269B4219c72F6855`
- Contract (`X1SentinelAIDecisionAnchor`): `0x19CA137e578A81B9FBD0f7ca5D77468e238e4646`
- Contract (`X1SentinelDepinAnchor`): `0x331Fdd4a93D9779030de8B086B4dfa21be11c6E2`

Frontend env values should align with:

```bash
NEXT_PUBLIC_CHAIN_ID=10778
NEXT_PUBLIC_RPC_URL=https://maculatus-rpc.x1eco.com/
NEXT_PUBLIC_CHAIN_EXPLORER_URL=https://maculatus-scan.x1eco.com/
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5C4Be8d3fF603cba1A25dB2D269B4219c72F6855
NEXT_PUBLIC_AI_DECISION_ANCHOR_ADDRESS=0x19CA137e578A81B9FBD0f7ca5D77468e238e4646
NEXT_PUBLIC_DEPIN_ANCHOR_ADDRESS=0x331Fdd4a93D9779030de8B086B4dfa21be11c6E2
```

## Prototype Scope

- Address risk checks
- Privacy telemetry display
- Recent community reports
- Report payload preparation flow
- Wallet connection + onchain report submission
- Onchain voting and report resolution actions
- AI risk + DePIN telemetry panels in address checks
- Onchain AI/DePIN anchor transaction flow from dashboard
- Transaction-status tracking (prepare, sign, submit, confirm, error)
