import { EthereumAddress } from "@thisisarchimedes/backend-sdk";

export default interface LedgerEntry {
    collateralAmount: BigInt;
    strategyAddress: EthereumAddress;
    strategyShares: BigInt;
    wbtcDebtAmount: BigInt;
    positionOpenBlock: BigInt;
    positionExpirationBlock: BigInt;
    liquidationBuffer: BigInt;
    PositionState: number;
    claimableAmount: BigInt;
}

function populateLedgerEntry(values: any[]): LedgerEntry {
    if (values.length < 9) {
        throw new Error('Insufficient values provided');
    }

    const ledgerEntry: LedgerEntry = {
        collateralAmount: BigInt(values[0]),
        strategyAddress: values[1] as EthereumAddress,
        strategyShares: BigInt(values[2]),
        wbtcDebtAmount: BigInt(values[3]),
        positionOpenBlock: BigInt(values[4]),
        positionExpirationBlock: BigInt(values[5]),
        liquidationBuffer: BigInt(values[6]),
        PositionState: values[7],
        claimableAmount: BigInt(values[8]),
    };

    return ledgerEntry;
}