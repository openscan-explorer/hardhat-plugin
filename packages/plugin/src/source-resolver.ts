import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * The parts of a solc build info file we need to recover source text.
 *
 * Hardhat 3 writes source names into the standard JSON input under a
 * "project/" (or "npm/") prefix, and records the mapping from the artifact's
 * `sourceName` to that key in `userSourceNameMap`.
 */
interface SolcBuildInfo {
  userSourceNameMap?: Record<string, string>;
  input?: {
    sources?: Record<string, { content?: string }>;
  };
}

/**
 * Source names already warned about, so a missing source is reported once per
 * process rather than on every request. The artifact loader re-reads the
 * deployment on each page load, so an ungated warning would repeat endlessly.
 */
const warnedSourceNames = new Set<string>();

/**
 * Read source text out of a build info file's standard JSON input.
 *
 * @param sourceName - Project-relative source name from the artifact
 * @param inputSourceName - Prefixed source name from the artifact, when present
 * @param buildInfo - Parsed build info, shape unverified
 * @returns Source text, or undefined if the input has no entry for it
 */
function readSourceFromBuildInfo(
  sourceName: string,
  inputSourceName: string | undefined,
  buildInfo: unknown,
): string | undefined {
  if (typeof buildInfo !== "object" || buildInfo === null) return undefined;

  const { userSourceNameMap, input } = buildInfo as SolcBuildInfo;
  const sources = input?.sources;
  if (!sources) return undefined;

  // Hardhat 3 artifacts carry the input source name directly; older build info
  // keys its sources by the plain source name.
  const candidates = [
    inputSourceName,
    userSourceNameMap?.[sourceName],
    sourceName,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const content = sources[candidate]?.content;
    if (typeof content === "string") return content;
  }

  return undefined;
}

/**
 * Resolve a contract's Solidity source.
 *
 * `sourceName` is relative to the project root, so it is joined as-is - this
 * works for contracts nested in subdirectories and for contracts compiled from
 * outside `contracts/`. When the file is not on disk (moved or deleted since
 * compilation, or an npm dependency rather than a project file), the source
 * text is recovered from the build info that ships alongside the artifact.
 *
 * @param opts.projectRoot - Absolute path to the Hardhat project root
 * @param opts.sourceName - Project-relative source name from the artifact
 * @param opts.inputSourceName - Prefixed source name from the artifact, when present
 * @param opts.buildInfo - Parsed build info for the artifact, when available
 * @returns Source text, or undefined if it could not be resolved
 */
export function resolveSourceCode(opts: {
  projectRoot: string;
  sourceName: string;
  inputSourceName?: string;
  buildInfo?: unknown;
}): string | undefined {
  const { projectRoot, sourceName, inputSourceName, buildInfo } = opts;

  const sourcePath = path.join(projectRoot, sourceName);
  if (existsSync(sourcePath)) {
    try {
      return readFileSync(sourcePath, "utf-8");
    } catch {
      // Fall through to build info
    }
  }

  const fromBuildInfo = readSourceFromBuildInfo(
    sourceName,
    inputSourceName,
    buildInfo,
  );
  if (fromBuildInfo !== undefined) return fromBuildInfo;

  if (!warnedSourceNames.has(sourceName)) {
    warnedSourceNames.add(sourceName);
    console.warn(
      `[openscan] Source not found for ${sourceName} (looked in ${sourcePath} and build info)`,
    );
  }

  return undefined;
}
