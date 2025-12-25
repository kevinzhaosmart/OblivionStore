import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:store-address", "Prints the OblivionStore address").setAction(async function (_taskArguments, hre) {
  const deployment = await hre.deployments.get("OblivionStore");
  console.log("OblivionStore address is " + deployment.address);
});

task("task:create-store", "Create a store with a name")
  .addParam("name", "The store name")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployment = await deployments.get("OblivionStore");

    const signer = (await ethers.getSigners())[0];
    const contract = await ethers.getContractAt("OblivionStore", deployment.address);

    const tx = await contract.connect(signer).createStore(taskArguments.name);
    console.log(`Creating store "${taskArguments.name}"... tx: ${tx.hash}`);
    await tx.wait();
    console.log("Store ready.");
  });

task("task:add-item", "Add or update an item with an encrypted quantity")
  .addParam("name", "Item name")
  .addParam("quantity", "Plain quantity to encrypt")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("OblivionStore");
    const signer = (await ethers.getSigners())[0];

    const quantity = parseInt(taskArguments.quantity);
    if (!Number.isInteger(quantity)) {
      throw new Error("Quantity must be an integer");
    }

    const encryptedValue = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add32(quantity)
      .encrypt();

    const contract = await ethers.getContractAt("OblivionStore", deployment.address);
    const tx = await contract
      .connect(signer)
      .addOrUpdateItem(taskArguments.name, encryptedValue.handles[0], encryptedValue.inputProof);

    console.log(
      `Adding item "${taskArguments.name}" with quantity=${quantity}... tx:${tx.hash} handle=${ethers.hexlify(encryptedValue.handles[0])}`,
    );
    await tx.wait();
    console.log("Item stored.");
  });

task("task:decrypt-store", "Read store data and decrypt item quantities")
  .addOptionalParam("owner", "Store owner address (defaults to first signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("OblivionStore");
    const signer = (await ethers.getSigners())[0];
    const owner = taskArguments.owner ?? signer.address;

    const contract = await ethers.getContractAt("OblivionStore", deployment.address);
    const store = await contract.getStore(owner);

    console.log(`Store name: ${store[0]}`);
    const itemNames: string[] = store[1];
    const encryptedQuantities = store[2];

    if (!itemNames.length) {
      console.log("No items stored yet.");
      return;
    }

    for (let i = 0; i < itemNames.length; i++) {
      const encrypted = encryptedQuantities[i];
      const clearValue = await fhevm.userDecryptEuint(FhevmType.euint32, encrypted, deployment.address, signer);
      console.log(`- ${itemNames[i]} => ${clearValue} (encrypted: ${encrypted})`);
    }
  });
