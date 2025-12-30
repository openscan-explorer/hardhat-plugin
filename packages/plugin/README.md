# `openscan-hardhat-links`

This is an example plugin that adds a task that prints a greeting.

## Installation

To install this plugin, run the following command:

```bash
npm install --save-dev openscan-hardhat-links
```

In your `hardhat.config.ts` file, import the plugin and add it to the `plugins` array:

```ts
import { defineConfig } from "hardhat/config";
import myPlugin from "openscan-hardhat-links";

export default defineConfig({
  plugins: [myPlugin],
});
```

## Usage

Do nothing, just expect links to openscan in hardhat logs

### Configuration

You can configure the greeting that's printed by using the `myConfig` field in your Hardhat config. For example, you can have this config:

```ts
import { defineConfig } from "hardhat/config";
import myPlugin from "openscan-hardhat-links";

export default defineConfig({
  plugins: [myPlugin],
  OpenScan: {
    url: "http://localhost:3030",
    chainId: "31337",
  },
  //...
});
```

### RPC Methods calls logs

This plugin adds some example code to log different network events. To see it in action, all you need to do is run your Hardhat tests, deployment, or a script.
