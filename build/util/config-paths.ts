import path from "path";
import { fileURLToPath } from "url";

/** Directory containing `foundryconfig.json` (helper-scripts package root). */
const helperScriptsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);

/** One module repo entry under `modules` in `foundryconfig.json`. */
export type FoundryModuleEntry = {
    path: string;
    hasUiExtenderTypes: boolean;
    hasMigrationTypes: boolean;
    /**
     * Paths relative to the selected install's Foundry `Data` folder (see `resolveWorldPackPath`),
     * e.g. `worlds/my-world/packs/my-compendium`. Used by `pack-world-compendiums` to sync with
     * `<module>/src/packs/<compendium-folder>/`.
     */
    foundryWorldPackPaths?: string[];
};

/**
 * Resolves a module path string from `foundryconfig.json` to an absolute directory.
 * Absolute paths are normalized; relative paths are resolved from the
 * helper-scripts directory (next to `foundryconfig.json`), not `process.cwd()`.
 */
export function resolveModulePath(modulePath: string): string {
    if (path.isAbsolute(modulePath)) {
        return path.normalize(modulePath);
    }
    return path.resolve(helperScriptsDir, modulePath);
}

/** Absolute directory for a `modules[]` object from `foundryconfig.json`. */
export function resolveModuleEntryPath(entry: FoundryModuleEntry): string {
    return resolveModulePath(entry.path);
}

/** All configured module directories, in config order. */
export function allResolvedModuleDirs(
    entries: readonly FoundryModuleEntry[],
): string[] {
    return entries.map(resolveModuleEntryPath);
}
