// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

contract CurvePoolMock {
    // Store balances of 2 tokens in an uint256 array
    uint256[2] private _balances;

    // Function to get the balance of a token
    function balances(uint8 index) public view returns (uint256) {
        require(index < 2, "Invalid token index");
        return _balances[index];
    }

    // Function to update the balances of the tokens
    function updateBalances(uint256 balance0, uint256 balance1) public {
        _balances[0] = balance0;
        _balances[1] = balance1;
    }
}
