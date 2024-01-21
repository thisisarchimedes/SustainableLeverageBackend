import { Signer, TransactionRequest } from "ethers";

export default class TransactionSimulator {
  constructor(private signer: Signer) { }
  simulateAndRunTransaction(transaction: TransactionRequest) {
    return this.signer.sendTransaction!(transaction);
  }
}
