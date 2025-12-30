import { OpenScanConfig, OpenScanUserConfig } from "./types.js";

import "hardhat/types/config";
declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    openScan?: OpenScanUserConfig;
  }

  interface HardhatConfig {
    openScan: OpenScanConfig;
  }
}

import "hardhat/types/network";
declare module "hardhat/types/network" {}
