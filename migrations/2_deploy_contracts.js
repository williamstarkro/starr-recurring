const u = require('../test/util.js')(web3);

const RCRToken = artifacts.require('RCRToken.sol')
const Subscription = artifacts.require('Subscription.sol');

module.exports = async (deployer, network, accounts) => {
  const block = await web3.eth.getBlock('latest');
  const blockDate = u.fromEthTime(block.timestamp);

  await deployer.deploy(RCRToken);

  const receiver = accounts[1];
  const token = RCRToken.address;
  const tokenAmount = u.BN('1e18');
  const periodInSeconds = u.ethDays(1);
  const gasPrice = u.BN('1e10');

  await deployer.deploy(Subscription, receiver, token, tokenAmount, periodInSeconds, gasPrice);
};
