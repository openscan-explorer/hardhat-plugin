import { defineConfig } from "hardhat/config";
import openScanPlugin from "@openscan/hardhat-plugin";
import hardhatIgnitionViemPlugin from "@nomicfoundation/hardhat-ignition-viem";

export default defineConfig({
  plugins: [hardhatIgnitionViemPlugin, openScanPlugin],
  solidity: "0.8.29",
  networks: {
    hardhatBlocks: {
      type: "edr-simulated",
      mining: {
        auto: false,
        interval: 5000,
      }
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
  },
  openScan: {
    url: "http://localhost:3030",
    chainId: 31337,
  },
});
