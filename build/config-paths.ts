import path from "path";
import { fileURLToPath } from "url";

/** Directory containing `foundryconfig.json` (helper-scripts package root). */
const helperScriptsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);

/**
 * Resolves a module entry from `foundryconfig.json` to an absolute directory.
 * Absolute paths are normalized; relative paths are resolved from the
 * helper-scripts directory (next to `foundryconfig.json`), not `process.cwd()`.
 */
export function resolveModulePath(entry: string): string {
    if (path.isAbsolute(entry)) {
        return path.normalize(entry);
    }
    return path.resolve(helperScriptsDir, entry);
}
