import {expect} from 'chai';
import sinon from 'sinon';
import {ethers} from 'ethers';
import EVMStorageManipulator from '../src/lib/EVMStorageManipulator';

describe('EVMStorageManipulator', function() {
  let manipulator: EVMStorageManipulator;
  let providerMock: sinon.SinonStubbedInstance<ethers.JsonRpcProvider>;
  let address: string;
  let slot: string;
  let slotInt: bigint;
  let balance: bigint;
  let userAddress: string;

  beforeEach(function() {
    providerMock = sinon.createStubInstance(ethers.JsonRpcProvider);
    manipulator = new EVMStorageManipulator(
      providerMock as sinon.SinonStubbedInstance<ethers.JsonRpcProvider>,
    );

    // Example test data
    address = '0x5380dfdfc34f2891922a46db399f734677903f62';
    slot = '0x01';
    slotInt = 1n;
    balance = BigInt(1000);
    userAddress = '0x5380dfdfc34f2891922a46db399f734677903f62';
  });

  it('setERC20Balance should set the balance and return true on success', async function() {
    const paddedValue = ethers.zeroPadValue(ethers.toBeHex(balance), 32);

    // Arrange
    providerMock.send.resolves(true);
    providerMock.getStorage.resolves(paddedValue);

    // Act
    const result = await manipulator.setERC20Balance(
        address,
        slotInt,
        userAddress,
        balance,
        false,
    );

    // Assert
    expect(result).to.be.true;
    sinon.assert.calledWith(providerMock.send, 'hardhat_setStorageAt');
    sinon.assert.calledWith(providerMock.getStorage);
  });

  it('setUint256 should set a uint256 value and return true on success', async function() {
    // Arrange
    const paddedValue = ethers.zeroPadValue(ethers.toBeHex(balance), 32);

    providerMock.send.resolves(true);
    providerMock.getStorage.resolves(paddedValue);

    // Act
    const result = await manipulator.setUint256(address, slot, balance);

    // Assert
    expect(result).to.be.true;
    sinon.assert.calledWith(providerMock.send, 'hardhat_setStorageAt');
  });

  it('readUint256 should return the correct value', async function() {
    // Arrange
    const expectedValue = '0x' + '00'.repeat(31) + '01';
    providerMock.getStorage.resolves(expectedValue);

    // Act
    const result = await manipulator.readUint256(address, slot);

    // Assert
    expect(result).to.equal(expectedValue);
    sinon.assert.calledWith(providerMock.getStorage);
  });

  it('readMapping should return the correct value', async function() {
    // Arrange
    const expectedValue = '0x' + '00'.repeat(31) + '01';
    providerMock.getStorage.resolves(expectedValue);

    // Act
    const result = await manipulator.readMapping(
        address,
        slotInt,
        userAddress,
        false,
    );

    // Assert
    expect(result).to.equal(expectedValue);
    sinon.assert.calledWith(providerMock.getStorage);
  });
});
