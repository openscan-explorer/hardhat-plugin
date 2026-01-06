import { defineConfig } from "hardhat/config";
import openScanPlugin from "openscan-hardhat-links";

export default defineConfig({
  plugins: [openScanPlugin],
  solidity: "0.8.29",
  networks: {
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
