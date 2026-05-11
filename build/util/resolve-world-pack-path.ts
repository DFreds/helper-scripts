import path from "path";

/**
 * Resolves a world compendium path from `foundryconfig.json`'s `fvtt.<version>.dataPath`.
 *
 * That value is the Foundry `--dataPath` root (the folder that *contains* `Data`, not the `Data` folder itself).
 * Entries in `foundryWorldPackPaths` are relative to the `Data` directory, for example:
 * `worlds/test14/packs/my-compendium`
 *
 * If a path already starts with `Data/` (any casing), it is joined directly to `dataPathRoot`
 * so both styles work.
 */
export function resolveWorldPackPath(
    dataPathRoot: string,
    relativePackPath: string,
): string {
    const trimmed = relativePackPath.trim().replace(/^[/\\]+/, "");
    const normalized = trimmed.replace(/\\/g, "/");
    if (/^data\//i.test(normalized)) {
        return path.normalize(path.join(dataPathRoot, normalized));
    }
    return path.normalize(path.join(dataPathRoot, "Data", normalized));
}

/** Directory name used under `src/packs` for this world pack path (last path segment). */
export function worldPackFolderName(relativePackPath: string): string {
    const trimmed = relativePackPath.trim().replace(/[/\\]+$/, "");
    const normalized = trimmed.replace(/\\/g, "/");
    const base = path.posix.basename(normalized);
    return base || "pack";
}
