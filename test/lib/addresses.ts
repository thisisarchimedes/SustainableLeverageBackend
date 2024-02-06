import {EthereumAddress} from '@thisisarchimedes/backend-sdk';

export const POSITION_LEDGER = new EthereumAddress('0xaE251Cd1a1d8121876cA609141bA5C63C0889e42');
export const LEVERAGED_STRATEGY = new EthereumAddress('0x8dA13e34324f95bF157593AE94AB1F24BEebD937');
export const CURVE_POOL = new EthereumAddress('0xB30dA2376F63De30b42dC055C93fa474F31330A5');
export const CURVE_POOL_ADAPTER = new EthereumAddress('0xb42Ca27d844a4106d3D5e64Ac971Bd66814aB08f');
export const FRAXBPALUSD_STRATEGY = new EthereumAddress('0xD078a331A8A00AB5391ba9f3AfC910225a78e6A1');
export const FRAXBP = new EthereumAddress('0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC');
export const ALUSD = new EthereumAddress('0xBC6DA0FE9aD5f3b0d58160288917AA56653660E9');

//* Token balances slot addresses *//
type Address = string;
export type MemorySlot = { slot: bigint; isVyper?: boolean; };

const tokenAddressToSlot: { [key: string]: MemorySlot } = {};
tokenAddressToSlot[ALUSD.toString()] = {slot: 1n};
tokenAddressToSlot[FRAXBP.toString()] = {slot: 7n, isVyper: true};

export const getTokenBalancesSlot = (address: Address): MemorySlot => tokenAddressToSlot[address];
