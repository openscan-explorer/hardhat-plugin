import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface ArtifactData {
  abi: unknown[];
  contractName: string;
  sourceName?: string;
  buildInfoId?: string;
  sourceCode?: string;
  buildInfo?: unknown;
  deployments: string[];
}

interface DeployedAddresses {
  [key: string]: string;
}

export type AddressMap = Record<string, ArtifactData>;

const CHAIN_ID = 31337;

let hasLoggedArtifacts = false;

export function findIgnitionDeployment(
  projectRoot: string,
): string | null {
  const deploymentPath = path.join(
    projectRoot,
    "ignition",
    "deployments",
    `chain-${CHAIN_ID}`,
  );
  const deployedAddressesPath = path.join(
    deploymentPath,
    "deployed_addresses.json",
  );

  if (existsSync(deployedAddressesPath)) {
    return deploymentPath;
  }

  return null;
}

export function loadArtifacts(
  deploymentPath: string,
  projectRoot: string,
): AddressMap {
  const addressMap: AddressMap = {};

  // Read deployed_addresses.json
  const deployedAddressesPath = path.join(
    deploymentPath,
    "deployed_addresses.json",
  );
  if (!existsSync(deployedAddressesPath)) {
    console.warn("[openscan] deployed_addresses.json not found");
    return addressMap;
  }

  const deployedAddresses: DeployedAddresses = JSON.parse(
    readFileSync(deployedAddressesPath, "utf-8"),
  );

  // Build contract name to address mapping
  const contractDeployments: Record<string, string> = {};
  for (const [moduleContract, address] of Object.entries(deployedAddresses)) {
    const contractName = moduleContract.split("#")[1];
    if (contractName) {
      contractDeployments[contractName] = address;
    }
  }

  // Read artifacts directory
  const artifactsDir = path.join(deploymentPath, "artifacts");
  if (!existsSync(artifactsDir)) {
    console.warn("[openscan] artifacts directory not found");
    return addressMap;
  }

  const artifactFiles = readdirSync(artifactsDir).filter((f) =>
    f.endsWith(".json"),
  );

  // Build-info directory
  const buildInfoDir = path.join(deploymentPath, "build-info");

  // Contracts source directory
  const contractsDir = path.join(projectRoot, "contracts");

  for (const artifactFile of artifactFiles) {
    const artifactPath = path.join(artifactsDir, artifactFile);

    let artifact: Record<string, unknown>;
    try {
      artifact = JSON.parse(
        readFileSync(artifactPath, "utf-8"),
      ) as Record<string, unknown>;
    } catch {
      continue;
    }

    const contractName = artifact.contractName as string | undefined;
    if (!contractName) continue;

    const deployedAddress = contractDeployments[contractName];
    if (!deployedAddress) continue;

    const artifactData: ArtifactData = {
      abi: (artifact.abi as unknown[]) || [],
      contractName,
      sourceName: artifact.sourceName as string | undefined,
      buildInfoId: artifact.buildInfoId as string | undefined,
      deployments: [deployedAddress],
    };

    // Try to load build info
    if (artifactData.buildInfoId && existsSync(buildInfoDir)) {
      const buildInfoPath = path.join(
        buildInfoDir,
        `${artifactData.buildInfoId}.json`,
      );
      if (existsSync(buildInfoPath)) {
        try {
          artifactData.buildInfo = JSON.parse(
            readFileSync(buildInfoPath, "utf-8"),
          );
        } catch {
          // Ignore build info errors
        }
      }
    }

    // Try to load source code
    if (artifactData.sourceName && existsSync(contractsDir)) {
      const sourceFileName = artifactData.sourceName.split("/").pop();
      if (sourceFileName) {
        const sourcePath = path.join(contractsDir, sourceFileName);
        if (existsSync(sourcePath)) {
          try {
            artifactData.sourceCode = readFileSync(sourcePath, "utf-8");
          } catch {
            // Ignore source code errors
          }
        }
      }
    }

    // Store by lowercase address
    addressMap[deployedAddress.toLowerCase()] = artifactData;
  }

  return addressMap;
}

export function loadIgnitionArtifacts(
  projectRoot: string,
): AddressMap | null {
  const deploymentPath = findIgnitionDeployment(projectRoot);
  if (!deploymentPath) {
    return null;
  }

  const shouldLog = !hasLoggedArtifacts;
  if (shouldLog) {
    hasLoggedArtifacts = true;
    console.log(
      `[openscan] Found Ignition deployment at: ${deploymentPath}`,
    );
  }

  const result = loadArtifacts(deploymentPath, projectRoot);

  if (shouldLog) {
    console.log(
      `[openscan] Loaded ${Object.keys(result).length} contract artifacts`,
    );
  }

  return result;
}
