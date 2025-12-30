# A Hardhat 3 project that uses your plugin

This is an example project that uses your plugin.

## Getting started

To run this project, you need to install the dependencies and build the plugin:

```sh
pnpm install
pnpm build
```

Start the node:

```sh
pnpm hardhat node
```

This will:

- Start the Hardhat development node on port 8545
- Automatically launch the OpenScan Explorer on <http://localhost:3030>
- Open your browser to the explorer interface

Then, you can run scripts in a separate terminal:

```sh
pnpm run deploy
pnpm run send-tx
```

All transactions will be logged with clickable OpenScan links in the console

## What's inside the project?

This is a minimal Hardhat 3 project that only has the built-in functionality of Hardhat and your plugin.

This means that you don't have `ethers,` `viem`, `mocha`, nor the Node.js test runner plugins.
