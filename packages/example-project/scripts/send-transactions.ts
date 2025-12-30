import { network } from "hardhat";

// Hardcoded contract address
const contractAddress = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

console.log("Sending transactions to Counter contract...");
console.log("Contract address:", contractAddress);

const { provider } = await network.connect("localhost");

const accounts = await provider.request({ method: "eth_accounts", params: [] });
const sender = accounts[0];

console.log(`Sending from account: ${sender}\n`);

// Function selectors for Counter contract methods
// Get the function selector for inc() - 0x371303c0
const incData = "0x371303c0";
// Get the function selector for incBy(uint256) - 0x70119d06
const incByData = "0x70119d06" + BigInt(5).toString(16).padStart(64, "0");

console.log("Transaction 1: Calling inc()");
const tx1 = await provider.request({
  method: "eth_sendTransaction",
  params: [
    {
      from: sender,
      to: contractAddress,
      data: incData,
    },
  ],
});
console.log(`Transaction hash: ${tx1}\n`);

// Wait a bit before sending the next transaction
await new Promise((resolve) => setTimeout(resolve, 1000));

console.log("Transaction 2: Calling incBy(5)");
const tx2 = await provider.request({
  method: "eth_sendTransaction",
  params: [
    {
      from: sender,
      to: contractAddress,
      data: incByData,
    },
  ],
});
