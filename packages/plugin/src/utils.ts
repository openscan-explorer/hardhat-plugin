import net from "node:net";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Check if port 3030 is available
 * @returns True if port is available, false otherwise
 */
export async function isPortAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(3030);
  });
}

/**
 * Open URL in default browser (cross-platform)
 * @param url - URL to open
 */
export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  let command: string;
  const networkPageUrl = `${url}/#/31337`;

  switch (platform) {
    case "darwin": // macOS
      command = `open "${networkPageUrl}"`;
      break;
    case "win32": // Windows
      command = `start "" "${networkPageUrl}"`;
      break;
    default: // Linux and others
      command = `xdg-open "${networkPageUrl}"`;
      break;
  }

  try {
    await execAsync(command);
  } catch (error) {
    // Silently fail - browser opening is optional
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[openscan] Could not auto-open browser: ${message}`);
  }
}

/**
 * Wait for HTTP service to be ready by polling
 * @param maxAttempts - Maximum number of polling attempts
 * @param delayMs - Delay between attempts in milliseconds
 * @throws Error if service does not become ready
 */
export async function waitForHttpService(
  maxAttempts: number = 20,
  delayMs: number = 500,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:3030`);
      if (response.ok) {
        return;
      }
    } catch {
      // Service not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(
    `HTTP service on port 3030 did not become ready after ${maxAttempts} attempts`,
  );
}
