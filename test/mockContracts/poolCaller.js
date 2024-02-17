require('dotenv').config()

const ethers = require('ethers');

// Define the ABI of the contract (replace with your actual ABI)
const contractAbi =  [
    {
        "constant": true,
        "inputs": [{"name": "index", "type": "uint8"}],
        "name": "balances",
        "outputs": [{"name": "", "type": "uint256"}],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "balance0", "type": "uint256"},
            {"name": "balance1", "type": "uint256"}
        ],
        "name": "updateBalances",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Define the address of the contract (replace with your actual contract address)
const contractAddress = process.env.MOCK_CURVE_POOL_ADDRESS;

async function main() {
    // Connect to the network
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    // Create a wallet from a private key
    let privateKey = process.env.PRIVATE_KEY;
    let wallet = new ethers.Wallet(privateKey, provider);

    // Create a contract instance
    const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

    // Call the updateBalances function
    const tx = await contract.updateBalances(10,60);

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    const balance0 = await contract.balances(0)
    const balance1 = await contract.balances(1)

    console.log("balances",[balance0,balance1]);
}

main().catch(console.error);