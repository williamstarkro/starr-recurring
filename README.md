## Starr Recurring Polygon Ethereum Contracts

## Quickstart

* Upon server instantiation, the process currently builds and deploys contracts. Please be sure to update `GANACHE_HOST` and `GANACHE_PORT` the environment variables file `.env` file when you are running a new local instance of Ganache.

## Environment variables Explanation

* **MNEMONIC** - Mnemonic phrase for Ganache testing environment
* **NODE-ENV** - Flag used to mark environment as development
* **GANACHE_HOST** - Host IP address of local Ganache instance
* **GANACHE_PORT**  - Local Ganache port

## Quickstart Guide

The following script will build and deploy all contracts to the testing environment.

```
./dev.sh
```

### Flow of dev.sh

1. Checks to make sure that all prerequisite applications are present and exits if any are missing
2. Checks for script parameters in run to see `-s` to see if initial setup is required. If required, environment files will be generated, node modules will be installed, and migrations will be generated.
3. Starts up ganache environment
4. Builds and deploys contracts to the local testing environment

### Unit Tests

You can run the unit tests using the following command:
```
npm test
```

## Scripts

### scripts/minify-contracts.js
Output contract ABIs to the folder specified in the first argument, e.g.
```
node scripts/minify-contracts.js ../abi/
```

## Contracts

### RCR Token
For testing purposes to have a token address.

#### Subscription
A subscription contract (one contract per subscription provider if you are locking `to`). This will allow off chain relayers to submit transactions on behalf of subscribers through signed meta transactions. There is an added benefit of being able to submit 1 TX to handle multiple payment cycles in the past.
