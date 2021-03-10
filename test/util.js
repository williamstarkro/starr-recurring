const pify = require('pify');
const assert = require('assert');
const BigNumber = require('bignumber.js');

import {isString, isNumber} from 'lodash';

module.exports = (web3) => {
  const revertError = 'VM Exception while processing transaction: revert';

  function BN(value) {
    return web3.utils.toBN(new BigNumber(value));
  }

  function BNA(values) {
    return values.map(value => BN(value));
  }

  // PLGProject States enum
  // eslint-disable-next-line no-unused-vars
  const [Inactive, Active, Cancelled, Funded, MilestoneFailed, Complete] = [0, 1, 2, 3, 4, 5];

  function toEthTime(date) {
    return BN(Math.trunc(date.getTime() / 1000));
  }

  function fromEthTime(timestamp) {
    return new Date(timestamp * 1000);
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function ethDays(days) {
    const now = new Date();
    const later = addDays(now, days);
    return BN(toEthTime(later) - toEthTime(now));
  }

  function padToBytes32(n) {
    while(n.length < 64) {
      n = `0${n}`;
    }
    return `0x${n}`;
  }

  function isHexStrict(hex) {
    return (isString(hex) || isNumber(hex)) && /^(-)?0x[0-9a-f]*$/i.test(hex);
  };

  function getSignatureParameter(signature) {
    if (!isHexStrict(signature)) {
        throw new Error(`Given value "${signature}" is not a valid hex string.`);
    }
    const r = signature.slice( 0, 66 );
    const s = `0x${signature.slice( 66, 130 )}`;
    let v = `0x${signature.slice( 130, 132 )}`;
    v = Number(BN(v).toString());
    if ( ![ 27, 28 ].includes( v ) ) v += 27;
    return {
        r,
        s,
        v
    };
  };

  function getHexSignature(signature, params) {
    let hex = signature.slice(0, 130);
    const v = params['v'].toString(16)
    hex += v
    return hex
  }

  // Safe convert sig to form solidity takes? 
  // For some reason v value is not being generated correctly by solidity
  function safeSignature(signature) {
    const params = getSignatureParameter(signature);
    return getHexSignature(signature, params);
  }

  function numToBytes32(num) {
    const bn = BN(num).toTwos(256);
    return padToBytes32(bn.toString(16));
  }

  async function shouldRevert(action, message) {
    try {
      await action;
    } catch(error) {
      // This is now a workaround since we are including require messages
      const revertErrorLength = revertError.length;
      const err = error.message.slice(0, revertErrorLength);
      assert.strictEqual(err, revertError, message);
      return;
    }
    assert.strictEqual(false, true, message);
  }

  async function increaseTime(days) {
    await pify(web3.currentProvider.send)({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [ethDays(days).toNumber()],
    });
    await pify(web3.currentProvider.send)({
      jsonrpc: '2.0',
      method: 'evm_mine',
    });
  }

  function assertBN(bn1, bn2, msg) {
    if(typeof bn1 === 'string') {
      bn1 = BN(bn1);
    }
    if(typeof bn2 === 'string') {
      bn2 = BN(bn2);
    }
    assert.strictEqual(bn1.toString(), bn2.toString(), msg);
  }

  async function assertBalance(token, addr, targetBalance, msg) {
    const balance = await token.methods.balanceOf(addr).call();
    if(!msg) {
      msg = `${targetBalance} should have been in account ${addr.toString(16)}`;
    }
    if(typeof targetBalance === 'string') {
      // targetBalance better be a BN!
      targetBalance = BN(targetBalance);
    }
    assertBN(balance, targetBalance, msg);
  }

  // Deploy contract using new web3 1.3 guidelines
  async function deployContract(ABI, bytecode, args, from, gas = 4000000) {
    const contract = await new web3.eth.Contract(ABI);
    contract.options.data = bytecode;
    contract.options.from = from;

    const ignore = await contract.deploy({
      arguments: args,
      data: bytecode,
    })
      .send({
        from,
        gas,
        gasPrice: '1',
      })
      .on('error', (err) => {
        console.log('error:', err);
      })
      .on('transactionHash', (err) => {
        if(err) {
          // console.log('transactionHash:', err);
        }
      })
      .on('receipt', (receipt) => {
        contract.options.address = receipt.contractAddress;
      });

    return contract;
  }

  async function initSubscription(Subscription, token, data) {
    const args = [data.receiver, token.options.address, data.tokenAmount.toString(),
      data.periodInSeconds.toString(), data.gasPrice.toString(),
    ];

    const subscription = await deployContract(Subscription.abi, Subscription.bytecode, args,
      data.owner, 6000000);

    return subscription;
  }

  async function initToken(Token, data) {
    const token = await deployContract(Token.abi, Token.bytecode, null, data.owner);

    const ownerBalance = await token.methods.balanceOf(data.owner).call();
    assert.strictEqual(BN(ownerBalance).toString(), BN('1e22').toString(), 'token assignment incorrect');

    return token;
  }

  const util = {
    addDays,
    ethDays,
    toEthTime,
    fromEthTime,
    shouldRevert,
    increaseTime,
    assertBN,
    assertBalance,
    initSubscription,
    initToken,
    numToBytes32,
    BN,
    BNA,
    getSignatureParameter,
    getHexSignature,
    safeSignature,
  };
  return util;
};
