const Web3 = require('web3');
const ganache = require('ganache-cli');
const assert = require('assert');

const RCRToken = require('../build/contracts/RCRToken.json');
const Subscription = require('../build/contracts/Subscription.json');

const provider = ganache.provider();
const web3 = new Web3(provider);

const u = require('./util.js')(web3);

describe('Subscription', async () => {
  let accounts;
  // eslint-disable-next-line one-var-declaration-per-line, one-var, no-unused-vars
  let owner, user1, user2, user3, user4, user5, user6, user7;
  let token;
  let subscription;
  let initData;

  let block;
  let blockDate;
  let relayer;

  let receiverBalance = u.BN(0);
  let relayerBalance = u.BN(0);

  it('sets all the data', async () => {
    accounts = await web3.eth.getAccounts();
    [owner, user1, user2, user3, user4, user5, user6, user7] = accounts;
    initData = {
      owner,
      receiver: user1,
      tokenAmount: u.BN('1e18'),
      periodInSeconds: u.ethDays(1),
      gasPrice: u.BN('1e10'),
    };
    relayer = user7;
  });


  it('Initialization', async () => {
    block = await web3.eth.getBlock('latest');
    blockDate = u.fromEthTime(block.timestamp);
    token = await u.initToken(RCRToken, initData);
    subscription = await u.initSubscription(Subscription, token, initData);

    await token.methods.transfer(user2, u.BN('1e20').toString()).send({
      from: owner,
      gas: 4000000,
      gasProce: '1',
    });
    const user1Balance = await token.methods.balanceOf(user2).call();
    assert.strictEqual(u.BN(user1Balance).toString(), u.BN('1e20').toString(), 'token transfer did not happen');


    await token.methods.transfer(user3, u.BN('1e20').toString()).send({
      from: owner,
      gas: 4000000,
      gasProce: '1',
    });
    const user2Balance = await token.methods.balanceOf(user2).call();
    assert.strictEqual(u.BN(user2Balance).toString(), u.BN('1e20').toString(), 'token transfer did not happen');

    await token.methods.transfer(user4, u.BN('1e20').toString()).send({
      from: owner,
      gas: 4000000,
      gasProce: '1',
    });
    const user3Balance = await token.methods.balanceOf(user3).call();
    assert.strictEqual(u.BN(user3Balance).toString(), u.BN('1e20').toString(), 'token transfer did not happen');
  });

  it('Test 2 subscriptions for user2', async () => {
    const startTime = u.addDays(blockDate, 2);

    await token.methods.approve(subscription.options.address, u.BN('1e20').toString()).send({
      from: user2,
      gas: 4000000,
      gasPrice: '1',
    });
    const subscription1Hash = await subscription.methods.getSubscriptionHash(user2, initData.receiver, token.options.address,
      initData.tokenAmount, u.toEthTime(startTime), initData.periodInSeconds, initData.gasPrice, u.BN(1).toString()).call();
    let signature1 = await web3.eth.sign(subscription1Hash, user2);
    signature1 = u.safeSignature(signature1);

    const subscription2Hash = await subscription.methods.getSubscriptionHash(user2, initData.receiver, token.options.address,
      initData.tokenAmount, u.toEthTime(startTime), initData.periodInSeconds, initData.gasPrice, u.BN(2).toString()).call();
    let signature2 = await web3.eth.sign(subscription2Hash, user2);
    signature2 = u.safeSignature(signature2);
    
    // Sanity check on executeSubscription fail (before start time)
    await u.shouldRevert(subscription.methods.executeSubscription(user2, initData.receiver, token.options.address,
      initData.tokenAmount, u.toEthTime(startTime), initData.periodInSeconds, initData.gasPrice, u.BN(1).toString(), signature1).send({
      from: relayer,
      gas: 4000000,
      gasPrice: '1',
    }),
    'Not enough time has passed');

    await u.increaseTime(2);
    let tx1 = await subscription.methods.executeSubscription(user2, initData.receiver, token.options.address,
      initData.tokenAmount, u.toEthTime(startTime), initData.periodInSeconds, initData.gasPrice, u.BN(1).toString(), signature1);

    let tx2 = await subscription.methods.executeSubscription(user2, initData.receiver, token.options.address,
      initData.tokenAmount, u.toEthTime(startTime), initData.periodInSeconds, initData.gasPrice, u.BN(2).toString(), signature2);

    let success = tx1.send({
      from: relayer,
      gas: 4000000,
      gasPrice: '1',
    });
    // first recurring pay + gas relaying
    let newUser2Balance = u.BN('1e20') - u.BN('1e18') - u.BN('1e10');
    await u.assertBalance(token, user2, newUser2Balance);
    receiverBalance += u.BN('1e18')
    await u.assertBalance(token, initData.receiver, receiverBalance);
    relayerBalance += u.BN('1e10')
    await u.assertBalance(token, relayer, relayerBalance);

    success = tx2.send({
      from: relayer,
      gas: 4000000,
      gasPrice: '1',
    });
    // first recurring pay + gas relaying
    newUser2Balance = u.BN('9.799999998e19');
    await u.assertBalance(token, user2, newUser2Balance);
    receiverBalance = u.BN('2e18')
    await u.assertBalance(token, initData.receiver, receiverBalance);
    relayerBalance = u.BN('2e10')
    await u.assertBalance(token, relayer, relayerBalance);

    // Sanity check on executeSubscription fail (before nextInterval)
    await u.shouldRevert(tx1.send({
      from: relayer,
      gas: 4000000,
      gasPrice: '1',
    }),
    'Not enough time has passed after the first');

    await u.increaseTime(2);
    success = await tx1.send({
      from: relayer,
      gas: 4000000,
      gasPrice: '1',
    });
    // second recurring pay + gas relaying (this includes 2 payments)
    newUser2Balance = u.BN('9.599999997e19');
    await u.assertBalance(token, user2, newUser2Balance);
    receiverBalance = u.BN('4e18');
    await u.assertBalance(token, initData.receiver, receiverBalance);
    relayerBalance = u.BN('3e10');
    await u.assertBalance(token, relayer, relayerBalance);

  });

  it('Test user3 cancels subscription', async () => {
    await token.methods.approve(subscription.options.address, u.BN('1e20').toString()).send({
      from: user3,
      gas: 4000000,
      gasPrice: '1',
    });
    const subscriptionHash = await subscription.methods.getSubscriptionHash(user3, initData.receiver, token.options.address,
      initData.tokenAmount, 0, initData.periodInSeconds, initData.gasPrice, u.BN(1).toString()).call();
    let signature = await web3.eth.sign(subscriptionHash, user3);
    signature = u.safeSignature(signature);

    await u.increaseTime(2);
    let success = await subscription.methods.executeSubscription(user3, initData.receiver, token.options.address,
      initData.tokenAmount, 0, initData.periodInSeconds, initData.gasPrice, u.BN(1).toString(), signature).send({
      from: relayer,
      gas: 4000000,
      gasPrice: '1',
    });
    // first recurring pay + gas relaying
    let newUser3Balance = u.BN('1e20') - u.BN('1e18') - u.BN('1e10');
    await u.assertBalance(token, user3, newUser3Balance);
    receiverBalance = u.BN('5e18')
    await u.assertBalance(token, initData.receiver, receiverBalance);
    relayerBalance = u.BN('4e10')
    await u.assertBalance(token, relayer, relayerBalance);

    success = await subscription.methods.cancelSubscription(user3, initData.receiver, token.options.address,
      initData.tokenAmount, 0, initData.periodInSeconds, initData.gasPrice, u.BN(1).toString(), signature).send({
      from: user3,
      gas: 4000000,
      gasPrice: '1',
    });

    await u.shouldRevert(subscription.methods.executeSubscription(user3, initData.receiver, token.options.address,
      initData.tokenAmount, 0, initData.periodInSeconds, initData.gasPrice, u.BN(1).toString(), signature).send({
      from: relayer,
      gas: 4000000,
      gasPrice: '1',
    }),
    'Subscription has been cancelled');
  });

  it('Test someone tries to fake a hash for user4', async () => {
    await token.methods.approve(subscription.options.address, u.BN('1e20').toString()).send({
      from: user4,
      gas: 4000000,
      gasPrice: '1',
    });
    const subscriptionHash = await subscription.methods.getSubscriptionHash(user4, initData.receiver, token.options.address,
      initData.tokenAmount, 0, initData.periodInSeconds, initData.gasPrice, u.BN(1).toString()).call();
    let signature = await web3.eth.sign(subscriptionHash, user5);
    signature = u.safeSignature(signature);

    await u.shouldRevert(subscription.methods.executeSubscription(user4, initData.receiver, token.options.address,
      initData.tokenAmount, 0, initData.periodInSeconds, initData.gasPrice, u.BN(1).toString(), signature).send({
      from: relayer,
      gas: 4000000,
      gasPrice: '1',
    }),
    'Someone tried to spoof a signature!');
  });
});
