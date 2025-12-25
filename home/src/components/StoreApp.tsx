import { useEffect, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient } from 'wagmi';

import { Header } from './Header';
import { OBLIVION_STORE_ADDRESS, oblivionStoreAbi } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';

type InventoryRow = {
  name: string;
  encrypted: string;
  decrypted?: string;
  decrypting?: boolean;
};

export function StoreApp() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [hasStore, setHasStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeNameInput, setStoreNameInput] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loadingStore, setLoadingStore] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);

  const addressUnset = true;
  const canTransact = isConnected && !!instance && !!signerPromise && !addressUnset;

  useEffect(() => {
    if (!address || !publicClient || addressUnset) {
      setHasStore(false);
      setItems([]);
      setStoreName('');
      return;
    }

    const load = async () => {
      setLoadingStore(true);
      try {
        const response = await publicClient.readContract({
          address: OBLIVION_STORE_ADDRESS,
          abi: oblivionStoreAbi,
          functionName: 'getStore',
          args: [address],
        });

        const [name, itemNames, encryptedQuantities] = response as [string, string[], readonly string[]];
        setHasStore(true);
        setStoreName(name);
        setStoreNameInput(name);
        const mapped = itemNames.map((label, idx) => ({
          name: label,
          encrypted: String(encryptedQuantities[idx]),
        }));
        setItems(mapped);
      } catch (error) {
        setHasStore(false);
        setStoreName('');
        setItems([]);
      } finally {
        setLoadingStore(false);
      }
    };

    load();
  }, [address, publicClient, refreshIndex, addressUnset]);

  const handleCreateOrRename = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canTransact || !storeNameInput.trim()) {
      return;
    }

    setCreatingStore(true);
    setStatusText(hasStore ? 'Updating store name...' : 'Creating your store...');

    try {
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet not ready');
      }

      const contract = new Contract(OBLIVION_STORE_ADDRESS, oblivionStoreAbi, signer);
      const tx = hasStore
        ? await contract.renameStore(storeNameInput.trim())
        : await contract.createStore(storeNameInput.trim());

      await tx.wait();
      setStatusText('Store synced on-chain.');
      setRefreshIndex(value => value + 1);
    } catch (error) {
      console.error(error);
      setStatusText('Unable to update the store. Please retry.');
    } finally {
      setCreatingStore(false);
    }
  };

  const handleAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canTransact || !instance || !address || !itemName.trim()) {
      return;
    }
    if (!hasStore) {
      setStatusText('Create your store first.');
      return;
    }

    const parsed = parseInt(quantity, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setStatusText('Quantity must be a positive integer.');
      return;
    }

    setSubmittingItem(true);
    setStatusText('Encrypting quantity...');

    try {
      const buffer = instance.createEncryptedInput(OBLIVION_STORE_ADDRESS, address);
      buffer.add32(parsed);
      const encryptedInput = await buffer.encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet not ready');
      }

      const contract = new Contract(OBLIVION_STORE_ADDRESS, oblivionStoreAbi, signer);
      const tx = await contract.addOrUpdateItem(itemName.trim(), encryptedInput.handles[0], encryptedInput.inputProof);
      setStatusText('Submitting transaction...');
      await tx.wait();

      setItemName('');
      setQuantity('');
      setStatusText('Item saved privately.');
      setRefreshIndex(value => value + 1);
    } catch (error) {
      console.error(error);
      setStatusText('Unable to store this item. Please try again.');
    } finally {
      setSubmittingItem(false);
    }
  };

  const decryptItem = async (row: InventoryRow) => {
    if (!instance || !address || !signerPromise) {
      setStatusText('Encryption service not ready yet.');
      return;
    }

    setItems(current =>
      current.map(item => (item.name === row.name ? { ...item, decrypting: true, decrypted: undefined } : item)),
    );

    try {
      const keypair = instance.generateKeypair();
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [OBLIVION_STORE_ADDRESS];
      const handleContractPairs = [{ handle: row.encrypted, contractAddress: OBLIVION_STORE_ADDRESS }];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet not ready');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const response = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedValue = response[row.encrypted] ?? '';

      setItems(current =>
        current.map(item =>
          item.name === row.name ? { ...item, decrypted: String(decryptedValue), decrypting: false } : item,
        ),
      );
      setStatusText('');
    } catch (error) {
      console.error(error);
      setStatusText('Unable to decrypt this quantity right now.');
      setItems(current =>
        current.map(item => (item.name === row.name ? { ...item, decrypting: false } : item)),
      );
    }
  };

  return (
    <div className="store-shell">
      <Header />
      <div className="store-body">
        <div className="overview-cards">
          <div className="panel">
            <h3>Connection</h3>
            <p>{isConnected ? 'Wallet connected' : 'Connect a wallet to start managing your store.'}</p>
          </div>
          <div className="panel">
            <h3>Encryption</h3>
            <p>
              {zamaError
                ? zamaError
                : zamaLoading
                  ? 'Preparing Zama relayer...'
                  : 'Relayer ready for encryption and user decryption.'}
            </p>
          </div>
          <div className="panel">
            <h3>Contract</h3>
            <p>
              {addressUnset
                ? 'Set the Sepolia contract address to interact.'
                : `Targeting contract ${OBLIVION_STORE_ADDRESS.slice(0, 8)}…${OBLIVION_STORE_ADDRESS.slice(-6)}`}
            </p>
          </div>
        </div>

        <div className="store-grid">
          <div className="card">
            <div className="pill">Store profile</div>
            <h2>{hasStore ? storeName || 'Your encrypted shop' : 'Name your store'}</h2>
            <p>Deploy a new store name or rename the one you already created.</p>

            <form onSubmit={handleCreateOrRename} className="form-grid">
              <div className="field">
                <label>Store name</label>
                <input
                  className="input"
                  value={storeNameInput}
                  onChange={event => setStoreNameInput(event.target.value)}
                  placeholder="ex: Midnight Market"
                />
              </div>
              <div className="button-row">
                <button className="btn primary" disabled={!canTransact || creatingStore} type="submit">
                  {hasStore ? 'Update name' : 'Create store'}
                </button>
                {statusText && <span className="pill">{statusText}</span>}
              </div>
            </form>
          </div>

          <div className="card light">
            <div className="pill">Inventory</div>
            <h2>Add encrypted items</h2>
            <p>Quantities never leave the encrypted domain. Use any whole number to represent available stock.</p>

            <form onSubmit={handleAddItem} className="form-grid">
              <div className="field">
                <label>Item name</label>
                <input
                  className="input"
                  value={itemName}
                  onChange={event => setItemName(event.target.value)}
                  placeholder="ex: Sapphire Hoodie"
                  disabled={!hasStore}
                />
              </div>
              <div className="field">
                <label>Quantity</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={event => setQuantity(event.target.value)}
                  placeholder="0"
                  disabled={!hasStore}
                />
              </div>
              <div className="button-row">
                <button className="btn outline" type="submit" disabled={!canTransact || submittingItem || !hasStore}>
                  {submittingItem ? 'Saving...' : 'Encrypt & store'}
                </button>
                {!hasStore && <span className="pill">Create a store first</span>}
              </div>
            </form>
          </div>
        </div>

        <div className="panel" style={{ marginTop: '1.5rem' }}>
          <div className="inline">
            <h3 className="section-title">Inventory list</h3>
            <span className="badge">{items.length} items</span>
          </div>
          <p className="helper">
            Fetch encrypted quantities directly from the contract, then decrypt on demand with your wallet signature.
          </p>

          {loadingStore ? (
            <div className="empty-state">Loading store data...</div>
          ) : !hasStore ? (
            <div className="empty-state">No store detected for this wallet yet.</div>
          ) : items.length === 0 ? (
            <div className="empty-state">Add your first item to populate the list.</div>
          ) : (
            <div className="inventory-list">
              {items.map(item => (
                <div className="item-row" key={item.name}>
                  <div className="inline">
                    <strong>{item.name}</strong>
                    <span className="badge">Encrypted</span>
                  </div>
                  <div className="muted">Ciphertext: {item.encrypted}</div>
                  {item.decrypted ? (
                    <div className="status-line">
                      <span className="status-dot" />
                      <span>Decrypted quantity: {item.decrypted}</span>
                    </div>
                  ) : (
                    <button
                      className="btn outline"
                      style={{ width: 'fit-content' }}
                      onClick={() => decryptItem(item)}
                      disabled={item.decrypting || zamaLoading || !canTransact}
                    >
                      {item.decrypting ? 'Decrypting...' : 'Decrypt quantity'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
