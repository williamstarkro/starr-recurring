// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract RCRToken is ERC20 {
    constructor() public ERC20("starr recurring test token", "RCR") {
        _mint(msg.sender, 10000 * (10**uint256(decimals())));
    }
}
