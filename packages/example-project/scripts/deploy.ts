import { network, artifacts } from "hardhat";


const { provider } = await network.connect("localhost");

const accounts = await provider.request({ method: "eth_accounts", params: [] });
const deployer = accounts[0];

// Get the Counter contract artifact
const Counter = await artifacts.readArtifact("Counter");

// Deploy the contract
const deployTx = await provider.request({
  method: "eth_sendTransaction",
  params: [
    {
      from: deployer,
      data: Counter.bytecode,
    },
  ],
});

console.log(`Deployment transaction hash: ${deployTx}`);

// Wait for the transaction receipt
const receipt = await provider.request({
  method: "eth_getTransactionReceipt",
  params: [deployTx],
});

if (receipt && receipt.contractAddress) {
} else {
  console.log("Waiting for deployment to be mined...");
  // Poll for receipt
  let attempts = 0;
  while (attempts < 30) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [deployTx],
    });
    if (receipt && receipt.contractAddress) {
      console.log(`\nCounter contract deployed at: ${receipt.contractAddress}`);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }
}
