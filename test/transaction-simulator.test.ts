import { ethers } from 'hardhat';
import { assert } from 'chai';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import TransactionSimulator from '../src/lib/TransactionSimulator';

describe('Transaction Simulator Test', function () {
  let txSimulator: TransactionSimulator;
  let signer: HardhatEthersSigner;
  let receiver: HardhatEthersSigner;

  before(async () => {
    [signer, receiver] = await ethers.getSigners();
  });

  beforeEach(() => {
    txSimulator = new TransactionSimulator(signer);
	});

  it('Should succeed and be mined', async function () {
    // Amount to send
    const amount = ethers.parseEther("0.1"); // 0.1 ETH

    console.log(`Sending ${amount} ETH from ${signer.address} to ${receiver.address}`);

    const blockBefore = await signer.provider.getBlock("latest");

    // Create and send the transaction
    const tx = await txSimulator.simulateAndRunTransaction({
      to: receiver.address,
      value: amount,
    });

    console.log(`Transaction hash: ${tx.hash}`);

    // Wait for the transaction to be mined
    const response = await tx.wait();

    // Additional validation to ensure the transaction was mined
    const blockAfter = await signer.provider.getBlock("latest");
    assert(blockBefore!.number === blockAfter!.number - 1, "Transaction was not mined");
    console.log(blockBefore!.number, blockAfter!.number, "Block was mined");

    assert(isTransactionSuccessful(response!.hash!), "Transaction failed to be mined");

    console.log("Transaction confirmed!");
  });

  it('Should fail and not be mined', async function () {
    // Sending a small amount of Ether, but with an insufficient gas limit
    const transaction = {
      to: receiver.address,
      value: ethers.parseEther("0.01"), // 0.01 ETH
      gasLimit: 21000 - 1, // Insufficient gas limit
    };

    const blockBefore = await signer.provider.getBlock("latest");

    try {
      const tx = await txSimulator.simulateAndRunTransaction(transaction);
      await tx.wait();
    } catch (error) {
      console.error("Transaction failed as expected:", error);

      // Additional validation to ensure the transaction was not mined
      const blockAfter = await signer.provider.getBlock("latest");
      assert(blockBefore!.number === blockAfter!.number, "Transaction was mined, which is unexpected.");
      console.log(blockBefore!.number, blockAfter!.number, "Block was not mined");

      return; // Test is successful, as the transaction failed
    }

    assert.fail("Transaction succeeded, which is unexpected.");
  });

  //* Helper functions *//

  async function isTransactionSuccessful(txHash: string): Promise<boolean> {
    // Fetch the transaction receipt using the transaction hash
    const receipt = await signer.provider.getTransactionReceipt(txHash);

    if (receipt) {
      console.log("Transaction Receipt: ", receipt);

      // Check if the transaction was successful
      if (receipt.status === 1) {
        console.log("Transaction was successful and mined in block:", receipt.blockNumber);
        return true;
      } else {
        console.log("Transaction failed.");
        return false;
      }
    } else {
      console.log("Transaction not found or not mined yet.");
      return false;
    }
  }
});
