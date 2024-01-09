import { Signer, TransactionRequest } from "ethers";

export default class TransactionSimulator {
  constructor(private signer: Signer) { }
  async simulatAndRunTransaction(transaction: TransactionRequest) {
    return await this.signer.sendTransaction!(transaction);
  }
}