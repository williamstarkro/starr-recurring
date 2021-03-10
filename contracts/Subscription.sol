// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

/*
  Starr Recurring Payments

  Some references used to create this:
    https://medium.com/gitcoin/technical-deep-dive-architecture-choices-for-subscriptions-on-the-blockchain-erc948-5fae89cabc7a
    https://github.com/ethereum/EIPs/pull/1337
    https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1077.md
    https://github.com/gnosis/safe-contracts
 */

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";
import "openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";


contract Subscription {
    using SafeERC20 for IERC20;
    using Address for address;
    using ECDSA for bytes32;
    using SafeMath for uint256;

    // the owner is able to optionally set some high level settings for the subscription contract
    // so only meta transactions that match the requirements can be relayed
    address public receiver;
    address public token;
    uint256 public tokenAmount;
    uint256 public periodInSeconds;
    uint256 public gasPrice;

    // deployer of the smart contract
    address payable public owner;

    // because we are changing the meta of the transaction to arbitrarily set the nonce,
    // we now need another way to stop verifiers from doing all the transactions at once.
    // This sets when the next valid call for a recurring payment can be
    mapping(bytes32 => uint256) public nextTimestamp;

    // This is used to signal uniquencess for each subscription a user wants to run
    mapping(address => uint256) public extraNonce;

    event SubscriptionPaid(
        address indexed from, // the payer (subscriber)
        address indexed to, // the receiver (service provider)
        address token, // address of the token used to pay
        uint256 amount, // amount paid to the receiver
        uint256 periodSeconds, // the period in seconds between payments
        uint256 gasPrice, // the amount of tokens to pay relayer (0 for free)
        uint256 nonce // to allow multiple subscriptions with the same parameters
    );

    event SubscriptionCancelled(
        address indexed from, // the payer (subscriber)
        address indexed to, // the receiver (service provider)
        address token, // address of the token used to pay
        uint256 amount, // amount paid to the receiver
        uint256 periodSeconds, // the period in seconds between payments
        uint256 gasPrice, // the amount of tokens to pay relayer (0 for free)
        uint256 nonce // to allow multiple subscriptions with the same parameters
    );

    constructor(
        address _receiver,
        address _token,
        uint256 _tokenAmount,
        uint256 _periodInSeconds,
        uint256 _gasPrice
    ) public {
        receiver = _receiver;
        token = _token;
        tokenAmount = _tokenAmount;
        periodInSeconds = _periodInSeconds;
        gasPrice = _gasPrice;
    }

    // People can check whether a particular subscription is active and paid
    // Add a grace period for race conditions
    function isSubscriptionActive(
        bytes32 subscriptionHash,
        uint256 gracePeriodSeconds
    )
        external
        view
        returns (bool)
    {
        if (nextTimestamp[subscriptionHash]==uint256(-1)) {
            return false;
        }
        return (now <=
            nextTimestamp[subscriptionHash].add(gracePeriodSeconds)
        );
    }

    // We generate the hash of the subscription, including our relayer gas price (in the tokens)
    // This is done loosely based off of the eip-191 standard and eip-1077 standard
    function getSubscriptionHash(
        address _from, // the payer (subscriber)
        address _to, // the receiver (service provider)
        address _token, // address of the token used to pay
        uint256 _amount, // amount paid to the receiver
        uint256 _startTime, // starting time for when the first subscription payment can be executed
        uint256 _periodInSeconds, // the period in seconds between payments
        uint256 _gasPrice, // the amount of tokens to pay relayer (0 for free)
        uint256 _nonce // to allow multiple subscriptions with the same parameters
    )
        public
        view
        returns (bytes32)
    {
        // Check our optional requirements
        require(receiver == address(0) || _to == receiver, "receiver Failure");
        require(token == address(0) || _token == token, "token Failure");
        require(tokenAmount == 0 || _amount == tokenAmount, "tokenAmount Failure");
        require(periodInSeconds == 0 || _periodInSeconds == periodInSeconds, "periodInSeconds Failure");
        require(gasPrice == 0 || _gasPrice == gasPrice, "gasPrice Failure");

        return keccak256(
            abi.encodePacked(
                byte(0x19),
                byte(0),
                address(this),
                _from,
                _to,
                _token,
                _amount,
                _startTime,
                _periodInSeconds,
                _gasPrice,
                _nonce
        ));
    }

    // check if a subscription is signed correctly and the timestamp is ready for
    // the next execution to happen
    function isSubscriptionReady(
        address _from, // the payer (subscriber)
        address _to, // the receiver (service provider)
        address _token, // address of the token used to pay
        uint256 _amount, // amount paid to the receiver
        uint256 _startTime, // starting time for when the first subscription payment can be executed
        uint256 _periodInSeconds, // the period in seconds between payments
        uint256 _gasPrice, // the amount of tokens to pay relayer (0 for free)
        uint256 _nonce, // to allow multiple subscriptions with the same parameters
        bytes memory _signature // proof the subscriber signed the meta trasaction
    )
        public
        view
        returns (bool)
    {
        bytes32 subscriptionHash = getSubscriptionHash(
            _from, _to, _token, _amount, _startTime, _periodInSeconds, _gasPrice, _nonce
        );
        address signer = subscriptionHash.toEthSignedMessageHash().recover(_signature);
        uint256 allowance = IERC20(_token).allowance(_from, address(this));
        uint256 balance = IERC20(_token).balanceOf(_from);

        return (
            signer == _from &&
            _from != _to &&
            now >= _startTime &&
            now >= nextTimestamp[subscriptionHash] &&
            allowance >= _amount.add(_gasPrice) &&
            balance >= _amount.add(_gasPrice)
        );
    }

    // this is not as critical since a user can just choose to just stop
    // because you control the flow of tokens by approving this contract address,
    // but to make the contract an extensible example for later user I'll add this
    function cancelSubscription(
        address _from, // the payer (subscriber)
        address _to, // the receiver (service provider)
        address _token, // address of the token used to pay
        uint256 _amount, // amount paid to the receiver
        uint256 _startTime, // starting time for when the first subscription payment can be executed
        uint256 _periodInSeconds, // the period in seconds between payments
        uint256 _gasPrice, // the amount of tokens to pay relayer (0 for free)
        uint256 _nonce, // to allow multiple subscriptions with the same parameters
        bytes memory _signature // proof the subscriber signed the meta trasaction
    )
        external
        returns (bool success)
    {
        bytes32 subscriptionHash = getSubscriptionHash(
            _from, _to, _token, _amount, _startTime, _periodInSeconds, _gasPrice, _nonce
        );
        address signer = subscriptionHash.toEthSignedMessageHash().recover(_signature);

        // the signature must be valid
        require(signer == _from, "Invalid Signature for subscription cancellation");

        // make sure it's the subscriber
        require(_from == msg.sender, "msg.sender is not the subscriber");

        // nextTimestamp should be a timestamp that will never be reached
        // note: this does not actually cancel the transactions. Just makes it
        // impossible to execute the subscription payment
        nextTimestamp[subscriptionHash] = uint256(-1);

        emit SubscriptionCancelled(
            _from, _to, _token, _amount, _periodInSeconds, _gasPrice, _nonce
        );

        return true;
    }

    // assign cycle values
    function calculateCycles(
        bytes32 _subscriptionHash,
        uint256 _startTime,
        uint256 _periodInSeconds
    )
        public
        returns (uint256 cycles)
    {
        // If _startTime isn't set, we will set our recurring payments to start at this block
        uint256 startTime = (_startTime > 0? _startTime : now);
        // If nextTimestamp is already set, use that as the incrementer
        startTime = (nextTimestamp[_subscriptionHash] > 0? nextTimestamp[_subscriptionHash] : startTime);

        // calculate how many cycles it has been
        uint256 _cycles = 0;
        if (now.sub(startTime) > 0) {
            _cycles = now.sub(startTime).div(_periodInSeconds);
        }
        _cycles = _cycles + 1;

        // increment the startTime by the period so it wont be valid until then
        nextTimestamp[_subscriptionHash] = startTime.add(_cycles.mul(periodInSeconds));

        return _cycles;
    }

    // execute the transferFrom to pay the publisher from the subscriber
    // the subscriber has full control by approving this contract an allowance
    // Running this is conditional on subscriber submitting an allowance to this contract
    function executeSubscription(
        address _from, // the payer (subscriber)
        address _to, // the receiver (service provider)
        address _token, // address of the token used to pay
        uint256 _amount, // amount paid to the receiver
        uint256 _startTime, // starting time for when the first subscription payment can be executed
        uint256 _periodInSeconds, // the period in seconds between payments
        uint256 _gasPrice, // the amount of tokens to pay relayer (0 for free)
        uint256 _nonce, // to allow multiple subscriptions with the same parameters
        bytes memory _signature // proof the subscriber signed the meta trasaction
    )
        public
        returns (bool success)
    {
        // basic requirements
        require(_startTime == 0 || now > _startTime, "Cannot start paying before this is created");
        // make sure the subscription is valid and ready
        require(isSubscriptionReady(_from, _to, _token, _amount, _startTime, _periodInSeconds, _gasPrice, _nonce, _signature), "Subscription is not ready or conditions of transction are not met");

        bytes32 subscriptionHash = getSubscriptionHash(
            _from, _to, _token, _amount, _startTime, _periodInSeconds, _gasPrice, _nonce
        );
        uint256 cycles = calculateCycles(subscriptionHash, _startTime, _periodInSeconds);

        // check to see if this nonce is larger than the current count and we'll set that for this '_from'
        if (_nonce > extraNonce[_from]) {
            extraNonce[_from] = _nonce;
        }

        // uint256 totalAmount = cycles.mul(_amount);
        // let's make the transfer from the subscriber to the service provider
        uint256 startingBalanceProvider = IERC20(_token).balanceOf(_to);
        IERC20(_token).safeTransferFrom(_from, _to, cycles.mul(_amount));
        require(
            (startingBalanceProvider.add(cycles.mul(_amount))) == IERC20(_token).balanceOf(_to),
            "ERC20 Balance did not change correctly"
        );


        emit SubscriptionPaid(
            _from, _to, _token, cycles.mul(_amount), _periodInSeconds, _gasPrice, _nonce
        );

        // it is possible for the subscription execution to be run by a third party
        // incentivized in the terms of the subscription with a gasPrice of the tokens
        if (_gasPrice > 0) {
            // the relayer is incentivized by the token used for the subcsription
            // as far as the subscriber knows, they are
            // just sending X tokens to the service provider, but the service provider can
            // choose to send Y of those X to a relayer to run their transactions
            // the service provider will receive X - Y tokens
            // this must all be setup in the constructor
            // if not, the subscriber chooses all the params including what goes
            // to the service provider and what goes to the relayer
            uint256 startingBalanceRelayer = IERC20(_token).balanceOf(msg.sender);
            IERC20(_token).safeTransferFrom(_from, msg.sender, _gasPrice);
            require(
                (startingBalanceRelayer.add(_gasPrice)) == IERC20(_token).balanceOf(msg.sender),
                "ERC20 Balance did not change correctly"
            );
        }

        return true;
    }

    function getNextInterval(bytes32 subscriptionHash) public view returns (uint256) {
        return nextTimestamp[subscriptionHash];
    }

    function getNextNonce(address subscriber) public view returns (uint256) {
        return extraNonce[subscriber];
    }

    // we would like a way for the owner to completly destroy the subscription
    // contract to prevent further transfers
    function endContract()
        external
    {
        require(msg.sender==owner, "Only contract owner can end the contract");
        selfdestruct(owner);
    }
}
