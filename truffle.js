require('dotenv').config();
const HDWallet = require('truffle-hdwallet-provider');
const NonceTrackerSubprovider = require('web3-provider-engine/subproviders/nonce-tracker');
const web3 = require('web3');

const MNEMONIC = process.env.MNEMONIC;
const numAddressesToUnlock = 1;

// This function adds protection against the "nonce too low" error seen on some
// web3 provider server farms.
//
// For more details see:
// https://ethereum.stackexchange.com/questions/44349/truffle-infura-on-mainnet-nonce-too-low-error
function withNonceTracker(provider) {
  const nonceTracker = new NonceTrackerSubprovider();
  provider.engine._providers.unshift(nonceTracker); // eslint-disable-line
  nonceTracker.setEngine(provider.engine);
  return provider;
}


const truffleSetup = {
  networks: {
    development: {
      host: process.env.GANACHE_HOST,     // Localhost (default: none)
      port: process.env.GANACHE_PORT,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
    },
    matic: {
      provider: () => {
        return withNonceTracker(new HDWallet(
          MNEMONIC,
          `https://rpc-mumbai.matic.today`,
          0, numAddressesToUnlock,
        ));
      },
      network_id: 80001,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: { 
      version: "^0.6.0",
      docker: false,  
      optimizer: { enabled: true, runs: 200 } 
    }
  }
}
require('@babel/register');
require('@babel/polyfill');

module.exports = truffleSetup;
