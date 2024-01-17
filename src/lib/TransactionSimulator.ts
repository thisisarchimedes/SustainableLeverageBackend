import { Signer, TransactionRequest } from "ethers";

export default class TransactionSimulator {
  constructor(private signer: Signer) { }
  async simulateAndRunTransaction(transaction: TransactionRequest) {
    return await this.signer.sendTransaction!(transaction);
  }
}