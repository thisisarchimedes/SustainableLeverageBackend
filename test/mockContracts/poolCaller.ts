import {ethers} from 'ethers';

// Define the ABI of the contract (replace with your actual ABI)
const contractAbi = [
  'function updateBalances() public',
];

// Define the address of the contract (replace with your actual contract address)
const contractAddress = '0xYourContractAddress';

async function main() {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider('');

  // Create a wallet instance from a private key
  const privateKey = '0xYourPrivateKey';
  const wallet = new ethers.Wallet(privateKey, provider);

  // Create a contract instance
  const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

  // Call the updateBalances function
  const tx = await contract.updateBalances();

  // Wait for the transaction to be mined
  const receipt = await tx.wait();

  console.log(`Transaction mined: ${receipt.transactionHash}`);
}

main().catch(console.error);
