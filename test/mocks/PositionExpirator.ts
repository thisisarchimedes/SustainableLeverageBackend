import { ClosePositionParamsStruct } from "@thisisarchimedes/backend-sdk";

export default class PositionExpirator {
    async getBlockNumber() {
        // Mock implementation
        return Promise.resolve(100);
    }

    async expirePosition(nftId: string, closeParams: ClosePositionParamsStruct) {
        return Promise.resolve();
    }
}