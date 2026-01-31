import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { AddressMap } from "../artifacts.js";
import { Service } from "./base.js";

/**
 * MIME types for common file extensions
 */
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

/**
 * WebappService - Custom HTTP server for serving static files
 * No external dependencies - uses only Node.js built-in modules
 * Fixed port: 3030
 */
type ArtifactLoader = () => AddressMap | null;

export class WebappService extends Service {
  private distPath: string;
  private server: http.Server | null = null;
  private connections: Set<unknown> = new Set();
  private artifactLoader: ArtifactLoader | null;

  constructor(distPath: string, artifactLoader?: ArtifactLoader) {
    super();
    this.distPath = distPath;
    this.artifactLoader = artifactLoader ?? null;
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Validate dist path exists
      if (!fs.existsSync(this.distPath)) {
        reject(new Error(`Webapp dist folder not found at: ${this.distPath}`));
        return;
      }

      // Validate index.html exists
      const indexPath = path.join(this.distPath, "index.html");
      if (!fs.existsSync(indexPath)) {
        reject(
          new Error(`index.html not found in dist folder: ${this.distPath}`),
        );
        return;
      }

      // Create HTTP server
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Track connections for clean shutdown
      this.server.on("connection", (conn) => {
        this.connections.add(conn);
        conn.on("close", () => {
          this.connections.delete(conn);
        });
      });

      // Handle server errors
      this.server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          reject(new Error(`Port 3030 is already in use`));
        } else {
          reject(error);
        }
      });

      // Start listening
      this.server.listen(3030, () => {
        console.log(
          `[openscan] Explorer webapp running at http://localhost:3030`,
        );
        resolve();
      });

      // Note: blockProcess parameter is kept for future use
      // Currently always non-blocking as server runs in background
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        // Force close all active connections
        for (const conn of this.connections) {
          // @ts-expect-error -- conn is of type unknown
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          conn.destroy();
        }
        this.connections.clear();

        this.server!.close(() => {
          console.log("[openscan] Webapp server stopped");
          this.server = null;
          resolve();
        });
      });
    }
  }

  /**
   * Wait for server to be ready by polling the health endpoint
   */
  async waitForReady(maxAttempts = 20): Promise<void> {
    const delay = 100; // ms

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:3030`);
        if (response.ok) {
          return;
        }
      } catch {
        // Not ready yet, continue polling
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    throw new Error(
      `Webapp did not become ready after ${maxAttempts} attempts`,
    );
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    // Default to index.html for root
    let filePath = req.url === "/" ? "/index.html" : req.url || "/index.html";

    // Remove query string
    const queryIndex = filePath.indexOf("?");
    if (queryIndex !== -1) {
      filePath = filePath.substring(0, queryIndex);
    }

    // Remove hash fragment
    const hashIndex = filePath.indexOf("#");
    if (hashIndex !== -1) {
      filePath = filePath.substring(0, hashIndex);
    }

    // Security: prevent directory traversal attacks
    // Normalize the path and remove any ../ sequences
    filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");

    const absolutePath = path.join(this.distPath, filePath);

    // Additional security check: ensure path is within distPath
    const resolvedPath = path.resolve(absolutePath);
    const resolvedDistPath = path.resolve(this.distPath);
    if (!resolvedPath.startsWith(resolvedDistPath)) {
      this.send404(res);
      return;
    }

    // Check if file exists
    fs.stat(absolutePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // File not found - serve index.html for SPA routing
        // This allows client-side routing to work properly
        this.serveFile(path.join(this.distPath, "index.html"), res, ".html");
        return;
      }

      // Serve the file
      const ext = path.extname(absolutePath);
      this.serveFile(absolutePath, res, ext);
    });
  }

  /**
   * Inject artifact data into HTML by adding a script that writes to localStorage.
   * Called on each HTML request so artifacts are always fresh from disk.
   */
  private injectArtifactsScript(html: string): string {
    if (!this.artifactLoader) {
      return html;
    }

    let artifacts: AddressMap | null;
    try {
      artifacts = this.artifactLoader();
    } catch (error) {
      console.warn("[openscan] Failed to load artifacts:", error);
      return html;
    }

    if (!artifacts || Object.keys(artifacts).length === 0) {
      return html;
    }

    // Double-encode: first JSON.stringify produces the data string,
    // second wraps it as a safe JS string literal with proper escaping.
    const jsonString = JSON.stringify(JSON.stringify(artifacts));

    // Escape </script> to prevent premature tag closure
    const safeJsonString = jsonString.replace(/<\/script>/gi, "<\\/script>");

    const scriptTag =
      `<script>` +
      `try{localStorage.setItem("OPENSCAN_ARTIFACTS_JSON_V1",${safeJsonString})}` +
      `catch(e){console.warn("[openscan] Failed to inject artifacts:",e)}` +
      `</script>`;

    return html.replace("<body>", `<body>${scriptTag}`);
  }

  /**
   * Serve a file with proper MIME type and caching headers
   */
  private serveFile(
    filePath: string,
    res: http.ServerResponse,
    ext: string,
  ): void {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error(`[openscan] Error reading file ${filePath}:`, err);
        this.send500(res);
        return;
      }

      // Inject artifacts into HTML responses
      let responseBody: string | Buffer = data;
      if (ext === ".html") {
        responseBody = this.injectArtifactsScript(data.toString("utf-8"));
      }

      const contentLength =
        typeof responseBody === "string"
          ? Buffer.byteLength(responseBody, "utf-8")
          : responseBody.length;

      const mimeType = MIME_TYPES[ext] || "application/octet-stream";

      // Set cache headers for better performance
      const headers: Record<string, string> = {
        "Content-Type": mimeType,
        "Content-Length": String(contentLength),
      };

      // Cache static assets for 1 hour, but not HTML (for SPA updates)
      if (ext !== ".html") {
        headers["Cache-Control"] = "public, max-age=3600";
      } else {
        headers["Cache-Control"] = "no-cache";
      }

      res.writeHead(200, headers);
      res.end(responseBody);
    });
  }

  /**
   * Send 404 Not Found response
   */
  private send404(res: http.ServerResponse): void {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 Not Found");
  }

  /**
   * Send 500 Internal Server Error response
   */
  private send500(res: http.ServerResponse): void {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("500 Internal Server Error");
  }
}
