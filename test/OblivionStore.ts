import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { OblivionStore, OblivionStore__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("OblivionStore")) as OblivionStore__factory;
  const contract = (await factory.deploy()) as OblivionStore;
  const address = await contract.getAddress();

  return { contract, contractAddress: address };
}

describe("OblivionStore", function () {
  let signers: Signers;
  let contract: OblivionStore;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("creates a store with a name", async function () {
    const name = "Alice Shop";
    await contract.connect(signers.alice).createStore(name);

    const store = await contract.getStore(signers.alice.address);
    expect(store[0]).to.eq(name);
    expect(store[1].length).to.eq(0);
  });

  it("stores and decrypts item quantities", async function () {
    await contract.connect(signers.alice).createStore("Alice Shop");

    const quantity = 7;
    const encryptedQuantity = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(quantity)
      .encrypt();

    await contract
      .connect(signers.alice)
      .addOrUpdateItem("apple", encryptedQuantity.handles[0], encryptedQuantity.inputProof);

    const store = await contract.getStore(signers.alice.address);
    expect(store[1][0]).to.eq("apple");

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      store[2][0],
      contractAddress,
      signers.alice,
    );

    expect(decrypted).to.eq(quantity);
  });

  it("updates an existing item quantity", async function () {
    await contract.connect(signers.alice).createStore("Alice Shop");

    const original = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(3).encrypt();
    await contract
      .connect(signers.alice)
      .addOrUpdateItem("banana", original.handles[0], original.inputProof);

    const updated = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(11).encrypt();
    await contract
      .connect(signers.alice)
      .addOrUpdateItem("banana", updated.handles[0], updated.inputProof);

    const latest = await contract.getItem(signers.alice.address, "banana");
    const decrypted = await fhevm.userDecryptEuint(FhevmType.euint32, latest, contractAddress, signers.alice);

    expect(decrypted).to.eq(11);
  });

  it("renames a store", async function () {
    await contract.connect(signers.alice).createStore("Alice Shop");
    await contract.connect(signers.alice).renameStore("Alice Updated");

    const storeName = await contract.getStoreName(signers.alice.address);
    expect(storeName).to.eq("Alice Updated");
  });
});
