// SPDX-License-Identifier: MIT
pragma solidity 0.7.3;

contract CurvePoolMock {
    uint256[2] private _balances;

    function balances(uint8 index) public view returns (uint256) {
        require(index < 2, "Invalid token index");
        return _balances[index];
    }

    function updateBalances(uint256 balance0, uint256 balance1) public {
        _balances[0] = balance0;
        _balances[1] = balance1;
    }
}
