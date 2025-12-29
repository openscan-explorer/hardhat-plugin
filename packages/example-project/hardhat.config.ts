import { defineConfig } from "hardhat/config";
import myPlugin from "hardhat-my-plugin";

export default defineConfig({
  plugins: [myPlugin],
  solidity: "0.8.29",
  myConfig: {
    greeting: "Hola",
  },
});
