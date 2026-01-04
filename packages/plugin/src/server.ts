import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebappService } from "./services/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * OpenscanServer interface - manages webapp lifecycle
 * Fixed configuration: port 3030, always auto-opens browser
 */
export interface OpenscanServer {
  /**
   * Get references to running services
   */
  services(): {
    webappService: WebappService | null;
  };

  /**
   * Start the webapp server
   */
  listen(): Promise<void>;

  /**
   * Stop the webapp server
   */
  stop(): Promise<void>;

  /**
   * Get the webapp URL (always http://localhost:3030)
   */
  getWebappUrl(): string | null;

  /**
   * Get the webapp port (always 3030)
   */
  getWebappPort(): number;
}

/**
 * Create an OpenscanServer instance
 * Fixed dist path: packages/explorer/dist
 * Fixed port: 3030
 * Always auto-opens browser
 */
export function createOpenscanServer(): OpenscanServer {
  let webappService: WebappService | null = null;

  // Fixed dist path relative to plugin location
  // When compiled: packages/plugin/dist/src/server.js -> packages/plugin/dist/explorer
  const distPath = path.resolve(__dirname, "../explorer");

  return {
    services() {
      return { webappService };
    },

    async listen() {
      // Create webapp service
      webappService = new WebappService(distPath);

      // Start service (will throw if fails - fail fast strategy)
      await webappService.start();
      await webappService.waitForReady();
    },

    async stop() {
      if (webappService) {
        await webappService.stop();
        webappService = null;
      }
    },

    getWebappUrl() {
      return webappService ? `http://localhost:3030` : null;
    },

    getWebappPort() {
      return 3030;
    },
  };
}
