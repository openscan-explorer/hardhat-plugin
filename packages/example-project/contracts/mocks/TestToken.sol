// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/// @dev Lives in a second subdirectory so the explorer's source view is
/// exercised against more than one nested path.
contract TestToken {
    string public name = "Test Token";
    string public symbol = "TEST";
    uint8 public constant decimals = 18;

    uint public totalSupply;
    mapping(address => uint) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint value);

    constructor(uint initialSupply) {
        totalSupply = initialSupply;
        balanceOf[msg.sender] = initialSupply;
        emit Transfer(address(0), msg.sender, initialSupply);
    }

    function transfer(address to, uint value) public returns (bool) {
        require(to != address(0), "transfer: zero address");
        require(balanceOf[msg.sender] >= value, "transfer: insufficient balance");

        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;

        emit Transfer(msg.sender, to, value);
        return true;
    }
}
