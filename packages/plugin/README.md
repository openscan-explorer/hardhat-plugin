# `openscan-hardhat-links`

A Hardhat plugin that automatically launches the OpenScan Explorer webapp and adds OpenScan links to all transaction logs.

## Installation

To install this plugin, run the following command:

```bash
npm install --save-dev openscan-hardhat-links
```

In your `hardhat.config.ts` file, import the plugin and add it to the `plugins` array:

```ts
import { defineConfig } from "hardhat/config";
import openScanPlugin from "openscan-hardhat-links";

export default defineConfig({
  plugins: [openScanPlugin],
  networks: {
    ...
  },
  openScan: {
    url: "http://localhost:3030",
    chainId: 31337,
  },
});

```

## Features

This plugin provides two main features:

1. **Automatic OpenScan Explorer Launch**: When you start the Hardhat node, the plugin automatically:
   - Launches a local OpenScan Explorer webapp on port 3030
   - Opens your default browser to <http://localhost:3030>
   - Serves the explorer from the plugin's built-in webapp

2. **OpenScan Links in Logs**: All transaction-related logs include clickable OpenScan links:
   - Transaction hashes → OpenScan transaction view
   - Addresses → OpenScan address view
   - Blocks → OpenScan block view
   - Contract deployments → OpenScan contract view

## Usage

Simply start your Hardhat node:

```bash
npx hardhat node
```

The OpenScan Explorer will automatically launch and your browser will open to the explorer interface. All subsequent transactions will include OpenScan links in the console output

## How It Works

### Webapp Launch

The plugin hooks into Hardhat's network lifecycle using the `newConnection` hook. When the Hardhat node starts:

1. The hook detects the first network connection
2. Checks if port 3030 is available (fails fast if not)
3. Starts a custom HTTP server serving static files from the built-in explorer webapp
4. Opens your default browser to the explorer URL
5. Logs a success message with a clickable link

The webapp continues running as long as the Hardhat node is active and automatically cleans up when the node stops.

### Transaction Logging

The plugin uses the `onRequest` network hook to intercept all JSON-RPC requests. For relevant methods (like `eth_sendTransaction`, `eth_getTransactionReceipt`, etc.), it extracts transaction hashes, addresses, and block numbers, then outputs clickable OpenScan links to the console.

## Requirements

- Hardhat 3.x
- Node.js 24+
- Port 3030 must be available

## Troubleshooting

### Port 8545 or 3030 Already in Use

If you see an error about port 8545 or 3030 being in use, you need to free up that port:

```bash
kill -9 $(lsof -t -i:8545)
kill -9 $(lsof -t -i:3030)
```
