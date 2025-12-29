import { defineConfig } from "hardhat/config";
import MyPlugin from "../../../src/index.js";

export default defineConfig({
  plugins: [MyPlugin],
});
