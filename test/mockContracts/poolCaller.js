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
const contractAddress = '0x87670f49B6B9904C29715Dca38A338E321347058';

async function main() {
    // Connect to the network
    const provider = new ethers.JsonRpcProvider("http://ec2-54-198-59-29.compute-1.amazonaws.com:8545");

    // Create a wallet from a private key
    let privateKey = "0xfb3e889306aafa69793a67e74c09e657eec07c4c552543db26f3158cf53c2a57";
    let wallet = new ethers.Wallet(privateKey, provider);

    // Create a contract instance
    const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

    // Call the updateBalances function
    const tx = await contract.updateBalances(30,40);

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    const balance0 = await contract.balances(0)
    const balance1 = await contract.balances(1)

    console.log("balances",[balance0,balance1]);


    console.log(`Transaction mined: ${receipt.transactionHash}`);
}

main().catch(console.error);