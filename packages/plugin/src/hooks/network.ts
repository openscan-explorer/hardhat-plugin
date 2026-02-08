/* eslint-disable @typescript-eslint/no-misused-promises */
import type { HookContext, NetworkHooks } from "hardhat/types/hooks";
import { ChainType, NetworkConnection } from "hardhat/types/network";
import { createOpenscanServer, type OpenscanServer } from "../server.js";
import { DeploymentTracker } from "../deployment-tracker.js";
import { isPortAvailable, openBrowser } from "../utils.js";

// Helper function to create clickable terminal links
function createClickableLink(url: string, text?: string): string {
  const displayText = text || url;
  // OSC 8 escape sequence for hyperlinks: \e]8;;URL\e\\TEXT\e]8;;\e\\
  return `\x1b]8;;${url}\x1b\\${displayText}\x1b]8;;\x1b\\`;
}

// Module-level state for webapp server and deployment tracking
let webappServer: OpenscanServer | null = null;
let webappStarted = false;
let tracker: DeploymentTracker | null = null;

/**
 * Start the webapp server
 * - Checks port 3030 availability (fail fast if occupied)
 * - Starts server
 * - Auto-opens browser
 */
async function startWebapp() {
  try {
    // Check if port 3030 is available (fail fast)
    const portAvailable = await isPortAvailable();
    if (!portAvailable) {
      console.warn(
        "[openscan] Warning: Port 3030 is already in use. Explorer not started.",
      );
      return
    }

    // Create deployment tracker and start server
    tracker = new DeploymentTracker(process.cwd());
    webappServer = createOpenscanServer(tracker);
    await webappServer.listen();

    const webappUrl = webappServer.getWebappUrl()!;

    // Auto-open browser (always enabled)
    await openBrowser(webappUrl);
  } catch (error) {
    // Fail fast - throw error to stop execution
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to start OpenScan Explorer: ${message}`);
  }
}

export default async (): Promise<Partial<NetworkHooks>> => {
  const handlers: Partial<NetworkHooks> = {
    async newConnection<ChainTypeT extends ChainType | string>(
      context: HookContext,
      next: (
        nextContext: HookContext,
      ) => Promise<NetworkConnection<ChainTypeT>>,
    ): Promise<NetworkConnection<ChainTypeT>> {
      const connection = await next(context);

      // Start webapp on first connection (when Hardhat node starts)
      if (!webappStarted) {
        webappStarted = true;
        await startWebapp();
      }

      return connection;
    },
    async onRequest(context, networkConnection, jsonRpcRequest, next) {
      const result = await next(context, networkConnection, jsonRpcRequest);

      const { url, chainId } = context.config.openScan;

      // Log eth_sendTransaction with OpenScan links
      if (jsonRpcRequest.method === "eth_sendTransaction") {
        const txHash = (result as { result?: string })?.result;
        const txParams = (
          jsonRpcRequest.params as Array<{
            from?: string;
            to?: string;
            data?: string;
          }>
        )?.[0];

        if (txHash) {
          // Track contract deployments (no "to" address means deployment)
          if (tracker && txParams?.data && !txParams.to) {
            tracker.trackSendTransaction(txHash, txParams.data);
          }

          const txUrl = `${url}/#/${chainId}/tx/${txHash}`;
          console.log(
            `${"  Transaction:".padEnd(18)}${createClickableLink(txUrl)}`,
          );

          if (txParams?.from) {
            const fromUrl = `${url}/#/${chainId}/address/${txParams.from}`;
            console.log(
              `${"  From:".padEnd(18)}${createClickableLink(fromUrl)}`,
            );
          }

          if (txParams?.to) {
            const toUrl = `${url}/#/${chainId}/address/${txParams.to}`;
            console.log(`${"  To:".padEnd(18)}${createClickableLink(toUrl)}`);
          }
        }
      }

      // Detect when a transaction receipt is fetched (indicates transaction was mined)
      if (jsonRpcRequest.method === "eth_getTransactionReceipt") {
        const receipt = (
          result as {
            result?: {
              transactionHash: string;
              blockHash: string;
              blockNumber: string;
              from: string;
              to?: string;
              gasUsed: string;
              status?: string;
              contractAddress?: string;
            };
          }
        )?.result;

        if (receipt && receipt.blockNumber) {
          const txHash = receipt.transactionHash;
          const blockNumber = parseInt(receipt.blockNumber, 16);

          const txUrl = `${url}/#/${chainId}/tx/${txHash}`;
          const blockUrl = `${url}/#/${chainId}/block/${blockNumber}`;
          const fromUrl = `${url}/#/${chainId}/address/${receipt.from}`;

          console.log(
            `${"  Transaction:".padEnd(18)}${createClickableLink(txUrl)}`,
          );
          console.log(
            `${`  Block #${blockNumber}:`.padEnd(18)}${createClickableLink(blockUrl)}`,
          );
          console.log(`${"  From:".padEnd(18)}${createClickableLink(fromUrl)}`);

          if (receipt.to) {
            const toUrl = `${url}/#/${chainId}/address/${receipt.to}`;
            console.log(`${"  To:".padEnd(18)}${createClickableLink(toUrl)}`);
          }

          // If this is a contract deployment, track it and log the contract address
          if (receipt.contractAddress) {
            if (tracker) {
              tracker.trackDeploymentReceipt(txHash, receipt.contractAddress);
            }

            const contractUrl = `${url}/#/${chainId}/address/${receipt.contractAddress}`;
            console.log(
              `${"  Contract:".padEnd(18)}${createClickableLink(contractUrl)}`,
            );
          }

          console.log();
        }
      }

      // Log eth_accounts responses with OpenScan links
      if (jsonRpcRequest.method === "eth_accounts") {
        const accounts = (result as { result?: string[] })?.result;

        if (accounts && Array.isArray(accounts) && accounts.length > 0) {
          accounts.forEach((address: string, index: number) => {
            const label = `  [${index}]:`.padEnd(18);
            const addressUrl = `${url}/#/${chainId}/address/${address}`;
            console.log(`${label}${createClickableLink(addressUrl)}`);
          });
          console.log();
        }
      }

      return result;
    },
  };

  return handlers;
};

/**
 * Cleanup on process exit
 */
const cleanup = async () => {
  if (webappServer) {
    await webappServer.stop();
    webappServer = null;
  }
};

// Track if cleanup is in progress to prevent multiple cleanup calls
let cleanupInProgress = false;

// Handle SIGINT (Ctrl+C)
process.on("SIGINT", async () => {
  if (cleanupInProgress) return;
  cleanupInProgress = true;

  await cleanup();
  process.exit(0);
});

// Handle SIGTERM
process.on("SIGTERM", async () => {
  if (cleanupInProgress) return;
  cleanupInProgress = true;

  await cleanup();
  process.exit(0);
});
