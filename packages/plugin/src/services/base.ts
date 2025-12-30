import type { ChildProcess } from "child_process";

/**
 * Abstract base class for services (webapp server, external processes, etc.)
 * Uses fixed port 3030 for webapp
 */
export abstract class Service {
	public process: ChildProcess | null = null;
	public readonly port: number = 3030;

	constructor() {
		// Fixed port 3030
	}

	/**
	 * Start the service (blocking or non-blocking)
	 * @param blockProcess - If true, the service will block until stopped
	 */
	abstract start(blockProcess?: boolean): Promise<void>;

	/**
	 * Stop the service and cleanup resources
	 */
	abstract stop(): Promise<void>;

	/**
	 * Wait for service to be ready (health check)
	 * @param maxAttempts - Maximum number of health check attempts
	 */
	abstract waitForReady(maxAttempts?: number): Promise<void>;

	/**
	 * Handle process exit events with proper logging
	 */
	protected handleOnExit(name: string) {
		return (code: number | null, signal: NodeJS.Signals | null) => {
			if (signal) {
				console.log(`[openscan] ${name} received ${signal}, exiting...`);
			} else if (code !== null && code !== 0) {
				console.error(`[openscan] ${name} exited with code ${code}`);
			}
		};
	}

	/**
	 * Handle process errors with proper logging
	 */
	protected handleOnError(name: string, reject: (reason?: Error) => void) {
		return (error: Error) => {
			console.error(`[openscan] Error starting ${name}: ${error.message}`);
			reject(error);
		};
	}
}
