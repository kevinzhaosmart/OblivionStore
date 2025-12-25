import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { OblivionStore } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("OblivionStoreSepolia", function () {
  let signers: Signers;
  let contract: OblivionStore;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("OblivionStore");
      contractAddress = deployment.address;
      contract = await ethers.getContractAt("OblivionStore", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("creates or updates a store item on Sepolia", async function () {
    steps = 12;
    this.timeout(4 * 40000);

    const storeName = "Oblivion Store";
    const itemName = `sepolia-item-${Date.now() % 1_000_000}`;
    const quantity = 3;

    progress("Ensure SDK ready...");
    await fhevm.initializeCLIApi();

    progress("Check store availability...");
    const hasStore = await contract.hasStore(signers.alice.address);
    if (!hasStore) {
      progress(`Create store "${storeName}"...`);
      const txCreate = await contract.connect(signers.alice).createStore(storeName);
      await txCreate.wait();
    }

    progress("Encrypt quantity...");
    const encryptedQuantity = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(quantity)
      .encrypt();

    progress(`Store item ${itemName}...`);
    const tx = await contract
      .connect(signers.alice)
      .addOrUpdateItem(itemName, encryptedQuantity.handles[0], encryptedQuantity.inputProof);
    await tx.wait();

    progress("Read item back...");
    const encrypted = await contract.getItem(signers.alice.address, itemName);
    expect(encrypted).to.not.eq(ethers.ZeroHash);

    progress("Decrypt quantity...");
    const clear = await fhevm.userDecryptEuint(FhevmType.euint32, encrypted, contractAddress, signers.alice);
    progress(`Decrypted quantity=${clear}`);

    expect(clear).to.eq(quantity);
  });
});
