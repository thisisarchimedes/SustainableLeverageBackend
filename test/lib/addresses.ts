export const POSITION_LEDGER = '0xaE251Cd1a1d8121876cA609141bA5C63C0889e42';
export const LEVERAGED_STRATEGY = '0x8dA13e34324f95bF157593AE94AB1F24BEebD937';

export const CURVE_POOL = '0xB30dA2376F63De30b42dC055C93fa474F31330A5';
export const CURVE_POOL_ADAPTER = '0xb42Ca27d844a4106d3D5e64Ac971Bd66814aB08f';

export const FRAXBPALUSD_STRATEGY = '0xD078a331A8A00AB5391ba9f3AfC910225a78e6A1';
export const FRAXBP = '0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC';
export const ALUSD = '0xBC6DA0FE9aD5f3b0d58160288917AA56653660E9';

export const UNIV3_STRATEGY = '0x7694Cd972Baa64018e5c6389740832e4C7f2Ce9a';

export const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
export const EZETH_WETH_STRATEGY = '0x4f4c4D838c1bd66A1d19f599CA9e6C6c2F6104d2';
export const EZETH_WETH_AURA_POOL = '0x596192bB6e41802428Ac943D2f1476C1Af25CC0E';
export const EZETH_WETH_AURA_POOL_ADAPTER = '0x30C2C954F734f061C0fF254E310E8c93F7497a5B';
export const EZETH_WETH_BALANCER_POOL_ID = '0x596192bb6e41802428ac943d2f1476c1af25cc0e000000000000000000000659';
export const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const EZETH = '0xbf5495Efe5DB9ce00f80364C8B423567e58d2110';

//* Token balances slot addresses *//
export type MemorySlot = { slot: bigint; isVyper?: boolean; };

const tokenAddressToSlot: { [key: string]: MemorySlot } = {};
tokenAddressToSlot[ALUSD.toString()] = {slot: 1n};
tokenAddressToSlot[FRAXBP.toString()] = {slot: 7n, isVyper: true};

export const getTokenBalancesSlot = (address: string): MemorySlot => tokenAddressToSlot[address];
