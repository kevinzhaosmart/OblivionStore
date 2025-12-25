import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedStore = await deploy("OblivionStore", {
    from: deployer,
    log: true,
  });

  console.log(`OblivionStore contract: `, deployedStore.address);
};
export default func;
func.id = "deploy_oblivionStore"; // id required to prevent reexecution
func.tags = ["OblivionStore"];
