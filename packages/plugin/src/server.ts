import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebappService } from "./services/index.js";
import { loadIgnitionArtifacts } from "./artifacts.js";
import type { DeploymentTracker } from "./deployment-tracker.js";

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
 * Fixed port: 3030
 * Always auto-opens browser
 */
export function createOpenscanServer(
  tracker: DeploymentTracker,
): OpenscanServer {
  let webappService: WebappService | null = null;

  // Resolve dist path from @openscan/explorer package
  const explorerPkg = fileURLToPath(
    import.meta.resolve("@openscan/explorer/package.json"),
  );
  const distPath = path.dirname(explorerPkg);

  // Project root for finding Ignition deployments
  const projectRoot = process.cwd();

  // Compose artifact loader from both Ignition deployments and tracked raw deploys
  const artifactLoader = () => {
    const ignitionArtifacts = loadIgnitionArtifacts(projectRoot) ?? {};
    const trackedArtifacts = tracker.getArtifacts();
    const combined = { ...ignitionArtifacts, ...trackedArtifacts };
    return Object.keys(combined).length > 0 ? combined : null;
  };

  return {
    services() {
      return { webappService };
    },

    async listen() {
      // Create webapp service with artifact injection
      webappService = new WebappService(distPath, artifactLoader);

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
