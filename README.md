# Sustainable Leverage Backend

This repo contains different backend services for the Archimedes Finance SustainableLeverage

## Backend Services
* Positions Liquidator

## Quick start

### Install Dependencies

```bash
yarn install
```

### Environment

Repo is using `dotenvx` to manage environment variables. Create a `.env` file in the root of the project and add the following environment variables - see: [EventFetcher README.md](https://github.com/thisisarchimedes/EventFetcherService/tree/main?tab=readme-ov-file#get-env-file)

** Uniswap SDK require MAINNET RPC to work properly.

Environment example:
```bash
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

### E2E Tests
The E2E tests are a part of the global unit-test suite.
In case there is a need to run it independantly/locally/debug,
you can do:

```
yarn test --grep E2E
```

More on that and the configurations for the environments can be found [here](https://www.notion.so/archimedesfi/End-to-end-Position-Open-Close-Test-6534d535490947149e44a8f1571dad82).

### Running Scripts

*Configuring hardhat networks are on `hardhat.config.js`*

Add **--network external** to each command to broadcast to external rpc
configured in the hardhat config.

**!!! BE SURE TO RUN ON FORK ONLY !!!**
```
yarn hardhat run scripts/rebalance.ts --network external
yarn hardhat run scripts/unbalance.ts --netwoek external
yarn hardhat run scripts/unbalance-position.ts --netwoek external
yarn hardhat run scripts/changeAdjustInInterval.ts --netwoek external
```

### Run Liquidator Bot

```
yarn liquidator
```
