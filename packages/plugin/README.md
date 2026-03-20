# @openscan/hardhat-plugin

A Hardhat 3 plugin that automatically launches the OpenScan Explorer webapp and adds clickable OpenScan links to transaction logs in your terminal.

Learn more at <https://openscan.io>

## Installation

```bash
npm install --save-dev @openscan/hardhat-plugin
```

## Configuration

In your `hardhat.config.ts`, import the plugin and add it to the `plugins` array:

```ts
import openScanPlugin from "@openscan/hardhat-plugin";
import { defineConfig } from "hardhat/config";

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
    url: "http://localhost:3030", // default
    chainId: 31337, // default
  },
});
```

### Options

| Option    | Type     | Default                   | Description                      |
| --------- | -------- | ------------------------- | -------------------------------- |
| `url`     | `string` | `"http://localhost:3030"` | URL where the explorer is served |
| `chainId` | `number` | `31337`                   | Chain ID for the explorer links  |

## Features

### Automatic Explorer Launch

When the first network connection is established (e.g. via `npx hardhat node`), the plugin:

1. Checks if port 3030 is available
2. Starts a local HTTP server serving the OpenScan Explorer webapp
3. Opens your default browser to the explorer

The explorer serves contract artifacts (ABIs, source code, deployment addresses) so you can inspect deployed contracts directly in the browser. It supports both Hardhat Ignition deployments and raw deployment scripts.

### Clickable Transaction Links

The plugin intercepts JSON-RPC requests and logs clickable terminal links (via OSC 8 hyperlinks) for:

- **`eth_sendTransaction`** — logs links to the transaction, sender, and recipient addresses
- **`eth_getTransactionReceipt`** — logs links to the transaction, block, sender, recipient, and deployed contract address (if applicable)
- **`eth_accounts`** — logs links to each account address

### Contract Deployment Tracking

When contracts are deployed (transactions with no `to` address), the plugin matches the creation bytecode against compiled artifacts in your project. This allows the explorer to display the contract name, ABI, and source code for deployed contracts — even without Hardhat Ignition.

## Usage

### 1. Start the Hardhat node

```bash
npx hardhat node
```

The OpenScan Explorer will automatically launch and your browser will open.

### 2. Deploy contracts

With Hardhat Ignition:

```bash
npx hardhat ignition deploy ignition/modules/Counter.ts --network localhost
```

Or with a script:

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

### 3. Send transactions

```bash
npx hardhat run scripts/send-tx.ts --network localhost
```

All transactions will be logged with clickable OpenScan links in the terminal.

## Requirements

- Hardhat 3.x
- Node.js 24
- Port 3030 must be available (the explorer always runs on this port)

## Troubleshooting

### Port 3030 Already in Use

If the explorer fails to start, check what is using the port:

```bash
lsof -i :3030
```

Then stop the conflicting process, or if it's a leftover Hardhat/OpenScan process:

```bash
kill $(lsof -t -i:3030)
```

## License

MIT
