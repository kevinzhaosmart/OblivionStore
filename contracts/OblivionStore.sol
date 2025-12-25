// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title OblivionStore - Manage encrypted store inventories
contract OblivionStore is ZamaEthereumConfig {
    struct Store {
        string name;
        bool exists;
        string[] itemNames;
        mapping(bytes32 => euint32) quantities;
        mapping(bytes32 => bool) itemExists;
    }

    mapping(address => Store) private stores;

    event StoreCreated(address indexed owner, string name);
    event StoreRenamed(address indexed owner, string name);
    event ItemUpserted(address indexed owner, string itemName);

    /// @notice Create a store with the provided name.
    /// @param storeName The store name.
    function createStore(string calldata storeName) external {
        Store storage store = stores[msg.sender];
        require(!store.exists, "Store already exists");

        _setStoreName(store, storeName);
        store.exists = true;

        emit StoreCreated(msg.sender, storeName);
    }

    /// @notice Rename an existing store.
    /// @param newName The updated name.
    function renameStore(string calldata newName) external {
        Store storage store = stores[msg.sender];
        require(store.exists, "Store not found");

        _setStoreName(store, newName);

        emit StoreRenamed(msg.sender, newName);
    }

    /// @notice Add or update an item with an encrypted quantity.
    /// @param itemName The item name.
    /// @param encryptedQuantity Encrypted quantity handle.
    /// @param inputProof Proof for the encrypted input.
    function addOrUpdateItem(
        string calldata itemName,
        externalEuint32 encryptedQuantity,
        bytes calldata inputProof
    ) external {
        Store storage store = stores[msg.sender];
        require(store.exists, "Store not found");

        bytes32 itemKey = _requireItemName(itemName);

        euint32 quantity = FHE.fromExternal(encryptedQuantity, inputProof);
        store.quantities[itemKey] = quantity;

        if (!store.itemExists[itemKey]) {
            store.itemExists[itemKey] = true;
            store.itemNames.push(itemName);
        }

        FHE.allowThis(quantity);
        FHE.allow(quantity, msg.sender);

        emit ItemUpserted(msg.sender, itemName);
    }

    /// @notice Get the store details for a specific owner.
    /// @param owner Address of the store owner.
    /// @return storeName The stored name.
    /// @return itemNames The list of item names.
    /// @return quantities The encrypted quantities matching itemNames order.
    function getStore(
        address owner
    ) external view returns (string memory storeName, string[] memory itemNames, euint32[] memory quantities) {
        Store storage store = stores[owner];
        require(store.exists, "Store not found");

        uint256 length = store.itemNames.length;
        itemNames = new string[](length);
        quantities = new euint32[](length);

        for (uint256 i = 0; i < length; i++) {
            string memory name = store.itemNames[i];
            itemNames[i] = name;
            bytes32 itemKey = keccak256(bytes(name));
            quantities[i] = store.quantities[itemKey];
        }

        return (store.name, itemNames, quantities);
    }

    /// @notice Get the encrypted quantity for a specific item.
    /// @param owner Address of the store owner.
    /// @param itemName The item name.
    /// @return The encrypted quantity.
    function getItem(address owner, string calldata itemName) external view returns (euint32) {
        Store storage store = stores[owner];
        require(store.exists, "Store not found");

        bytes32 itemKey = keccak256(bytes(itemName));
        require(store.itemExists[itemKey], "Item not found");

        return store.quantities[itemKey];
    }

    /// @notice Check whether a store exists for an address.
    /// @param owner The store owner.
    /// @return True when a store exists.
    function hasStore(address owner) external view returns (bool) {
        return stores[owner].exists;
    }

    /// @notice Read the configured store name.
    /// @param owner The store owner.
    /// @return The store name.
    function getStoreName(address owner) external view returns (string memory) {
        Store storage store = stores[owner];
        require(store.exists, "Store not found");
        return store.name;
    }

    /// @notice List the item names for a store.
    /// @param owner The store owner.
    /// @return The item names.
    function getItemNames(address owner) external view returns (string[] memory) {
        Store storage store = stores[owner];
        require(store.exists, "Store not found");
        return store.itemNames;
    }

    function _setStoreName(Store storage store, string calldata storeName) private {
        require(bytes(storeName).length > 0, "Name required");
        store.name = storeName;
    }

    function _requireItemName(string calldata itemName) private pure returns (bytes32 itemKey) {
        require(bytes(itemName).length > 0, "Item name required");
        return keccak256(bytes(itemName));
    }
}
