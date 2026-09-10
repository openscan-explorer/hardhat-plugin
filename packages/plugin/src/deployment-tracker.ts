import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ArtifactData, AddressMap } from "./artifacts.js";
import { resolveSourceCode } from "./source-resolver.js";

interface CompiledArtifact {
  contractName: string;
  sourceName: string;
  inputSourceName?: string;
  abi: unknown[];
  bytecode: string;
  buildInfoId?: string;
}

/**
 * Tracks contract deployments from raw deploy scripts by matching
 * creation bytecodes against compiled Hardhat artifacts.
 */
export class DeploymentTracker {
  private projectRoot: string;
  private compiledArtifacts: CompiledArtifact[] = [];
  private trackedDeployments: AddressMap = {};
  private pendingTxs = new Map<string, string>();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.loadCompiledArtifacts();
  }

  /**
   * Scan Hardhat's artifacts/contracts/ directory for compiled contract artifacts.
   */
  private loadCompiledArtifacts(): void {
    const artifactsDir = path.join(this.projectRoot, "artifacts", "contracts");
    if (!existsSync(artifactsDir)) return;
    this.scanDir(artifactsDir);
  }

  private scanDir(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        this.scanDir(fullPath);
      } else if (entry.endsWith(".json")) {
        try {
          const content = JSON.parse(readFileSync(fullPath, "utf-8")) as Record<
            string,
            unknown
          >;
          if (content.contractName && content.abi && content.bytecode) {
            this.compiledArtifacts.push({
              contractName: content.contractName as string,
              sourceName: (content.sourceName as string) ?? "",
              inputSourceName: content.inputSourceName as string | undefined,
              abi: content.abi as unknown[],
              bytecode: content.bytecode as string,
              buildInfoId: content.buildInfoId as string | undefined,
            });
          }
        } catch {
          // skip invalid files
        }
      }
    }
  }

  /**
   * Called when eth_sendTransaction is intercepted for a contract deployment
   * (to field is null/undefined). Stores the creation bytecode for later matching.
   */
  trackSendTransaction(txHash: string, data: string): void {
    this.pendingTxs.set(txHash, data);
  }

  /**
   * Called when eth_getTransactionReceipt returns a contract deployment
   * (contractAddress is present). Matches creation bytecode against compiled
   * artifacts and stores the result.
   */
  trackDeploymentReceipt(txHash: string, contractAddress: string): void {
    const data = this.pendingTxs.get(txHash);
    if (!data) return;
    this.pendingTxs.delete(txHash);

    const artifact = this.findMatchingArtifact(data);
    if (!artifact) return;

    const entry: ArtifactData = {
      abi: artifact.abi,
      contractName: artifact.contractName,
      sourceName: artifact.sourceName,
      buildInfoId: artifact.buildInfoId,
      deployments: [contractAddress],
    };

    // Try to load build info (before source, which falls back to it)
    if (artifact.buildInfoId) {
      const buildInfoPath = path.join(
        this.projectRoot,
        "artifacts",
        "build-info",
        `${artifact.buildInfoId}.json`,
      );
      if (existsSync(buildInfoPath)) {
        try {
          entry.buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf-8"));
        } catch {
          // ignore
        }
      }
    }

    // Try to load source code
    if (artifact.sourceName) {
      entry.sourceCode = resolveSourceCode({
        projectRoot: this.projectRoot,
        sourceName: artifact.sourceName,
        inputSourceName: artifact.inputSourceName,
        buildInfo: entry.buildInfo,
      });
    }

    this.trackedDeployments[contractAddress.toLowerCase()] = entry;
  }

  private findMatchingArtifact(creationData: string): CompiledArtifact | null {
    const normalizedData = creationData.toLowerCase();
    for (const artifact of this.compiledArtifacts) {
      const normalizedBytecode = artifact.bytecode.toLowerCase();
      // bytecode must be meaningful (more than just "0x")
      if (
        normalizedBytecode.length > 2 &&
        normalizedData.startsWith(normalizedBytecode)
      ) {
        return artifact;
      }
    }
    return null;
  }

  getArtifacts(): AddressMap {
    return { ...this.trackedDeployments };
  }
}
