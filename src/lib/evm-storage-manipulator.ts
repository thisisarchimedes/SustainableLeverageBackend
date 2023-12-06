import { ethers } from 'ethers'

class EVMStorageManipulator {
  private provider: ethers.providers.JsonRpcProvider

  constructor(provider: ethers.providers.JsonRpcProvider) {
    this.provider = provider
  }

  /**
   * Sets the ERC20 balance for a specified address in a token contract.
   *
   * @param tokenAddress The address of the ERC20 token contract.
   * @param slot The storage slot associated with the balance mapping.
   * @param who The address of the user whose balance is to be set.
   * @param balance The new balance to set, as a string.
   * @param isVyper Boolean indicating if the contract is written in Vyper (affects storage key calculation).
   * @returns True if the operation was successful, false otherwise.
   */
  async setERC20Balance(
    tokenAddress: string,
    slot: string,
    who: string,
    balance: string,
    isVyper: boolean = false,
  ): Promise<boolean> {
    const paddedBalance = this.padToUint256(balance)
    const key = this.calculateStorageKey(slot, who, isVyper)
    return this.setStorageAt(
      tokenAddress,
      key,
      paddedBalance,
      `ERC20 balance set for user ${who} on token ${tokenAddress}`,
    )
  }

  /**
   * Sets a uint256 value in a specific storage slot of a contract.
   *
   * @param contractAddress The address of the contract.
   * @param storageSlot The slot number to modify.
   * @param value The uint256 value to set in the slot, as a string.
   * @returns True if the operation was successful, false otherwise.
   */
  async setUint256(
    contractAddress: string,
    storageSlot: string,
    value: string,
  ): Promise<boolean> {
    const paddedValue = this.padToUint256(value)
    return this.setStorageAt(
      contractAddress,
      storageSlot,
      paddedValue,
      `Uint256 value set at slot ${storageSlot} for contract ${contractAddress}`,
    )
  }

  /**
   * Reads a uint256 value from a specific storage slot of a contract.
   *
   * @param contractAddress The address of the contract.
   * @param storageSlot The slot number to read from.
   * @returns The uint256 value from the storage slot as a BigNumber.
   */
  async readUint256(
    contractAddress: string,
    storageSlot: string,
  ): Promise<ethers.BigNumber> {
    return this.readStorageAt(contractAddress, storageSlot)
  }

  /**
   * Reads a value from a mapping in a contract's storage using a calculated key.
   *
   * @param contractAddress The address of the contract containing the mapping.
   * @param mappingSlot The storage slot associated with the start of the mapping.
   * @param userAddress The address to be used in the key calculation for the mapping.
   * @param isVyper Boolean indicating if the contract is written in Vyper (affects storage key calculation).
   * @returns The value stored in the mapping for the given key.
   */
  async readMapping(
    contractAddress: string,
    mappingSlot: string,
    userAddress: string,
    isVyper: boolean = false,
  ): Promise<string> {
    const key = this.calculateStorageKey(mappingSlot, userAddress, isVyper)
    return this.readStorageAt(contractAddress, key)
  }

  /**
   * Pads a given value to a uint256 format.
   *
   * @param value The value to be padded, represented as a string.
   * @returns The value padded to a 32-byte hex string, suitable for uint256.
   */
  private padToUint256(value: string): string {
    return ethers.utils.hexZeroPad(
      ethers.BigNumber.from(value).toHexString(),
      32,
    )
  }

  /**
   * Sets a value in a contract's storage at a specified slot.
   *
   * @param contractAddress The address of the contract.
   * @param storageSlot The storage slot where the value will be set.
   * @param value The value to set, as a 32-byte hex string.
   * @param successMessage A message to log on successful setting of the value.
   * @returns True if the operation was successful, false otherwise.
   */
  private async setStorageAt(
    contractAddress: string,
    storageSlot: string,
    value: string,
    successMessage: string,
  ): Promise<boolean> {
    try {
      const response = await this.provider.send('tenderly_setStorageAt', [
        contractAddress,
        storageSlot,
        value,
      ])
      if (response) {
        console.log(successMessage)
        const storageValue = await this.readStorageAt(
          contractAddress,
          storageSlot,
        )

        return storageValue === value
      }
      return false
    } catch (error) {
      throw new Error(`Error in setStorageAt: ${error}`)
    }
  }

  /**
   * Reads a value from a contract's storage at a specified slot.
   *
   * @param contractAddress The address of the contract.
   * @param storageSlot The storage slot to read the value from.
   * @returns The value from the specified storage slot.
   */
  private async readStorageAt(
    contractAddress: string,
    storageSlot: string,
  ): Promise<any> {
    try {
      return await this.provider.getStorageAt(contractAddress, storageSlot)
    } catch (error) {
      console.error(`Error in readStorageAt: ${error}`)
      throw error
    }
  }

  /**
   * Calculates the storage key for accessing mappings in contract storage,
   * especially for ERC20 token balances and similar mappings.
   *
   * @param mappingSlot The storage slot of the mapping itself.
   * @param userAddress The address used as a key in the mapping.
   * @param isVyper Boolean indicating if the contract is written in Vyper (affects key calculation).
   * @returns The calculated storage key as a hex string.
   */
  private calculateStorageKey(
    mappingSlot: string,
    userAddress: string,
    isVyper: boolean,
  ): string {
    const keyComponents = isVyper
      ? [mappingSlot, userAddress]
      : [userAddress, mappingSlot]
    return ethers.utils.solidityKeccak256(['uint256', 'uint256'], keyComponents)
  }
}

export default EVMStorageManipulator;