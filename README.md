# Sustainable Leverage Backend

This repo contains different backend services for the Archimedes Finance SustainableLeverage

## Backend Services
* Positions Liquidator

## Quick start

### Install Dependencies
#### Archimedes Finance BackendSDK
Once of the dependencies is the backend-sdk package which requires
GitHub's PAT_TOKEN:
```bash
export PAT_TOKEN={PAT_TOKEN}
```

```bash
yarn install
```

### Environment

Repo is using `dotenvx` to manage environment variables. Create a `.env` file in the root of the project and add the following environment variables - see: [EventFetcher README.md](https://github.com/thisisarchimedes/EventFetcherService/tree/main?tab=readme-ov-file#get-env-file)

** Uniswap SDK require MAINNET RPC to work properly.

Environment example:
```bash
PAT_TOKEN=
PRIVATE_KEY=
MAINNET_RPC_URL=
RPC_URL=
S3_BUCKET_CONFIG=
S3_ADDRESSES_KEY=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
NEW_RELIC_API_KEY=
ENVIRONMENT=local
```

### Linting

```bash
yarn lint
```

### Build

```bash
yarn build
```

### Running Tests

```bash
yarn test
```

### Running Scripts

*Configuring hardhat networks are on `hardhat.config.js`*

Add **--network external** to each command to broadcast to external rpc
configured in the hardhat config.

```
yarn hardhat run scripts/rebalance.ts
yarn hardhat run scripts/unbalance.ts
yarn hardhat run scripts/unbalance-position.ts
yarn hardhat run scripts/changeAdjustInInterval.ts
```

### Run Liquidator Bot

```
yarn liquidator
```
