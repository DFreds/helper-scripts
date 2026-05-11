/**
 * Pack or unpack LevelDB compendiums between a Foundry world's `Data/.../packs/...` folder
 * and each module's `src/packs/<compendium-folder>/`.
 *
 * Requires `foundryWorldPackPaths` on module entries (paths relative to the install's `Data`
 * folder, e.g. `worlds/my-world/packs/my-compendium`). The selected FVTT install's `dataPath`
 * (--dataPath root, parent of `Data`) is combined with those paths via `resolveWorldPackPath`.
 */
import fs from "fs";
import path from "path";
import prompts from "prompts";

// @ts-expect-error No types for @foundryvtt/foundryvtt-cli
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";

import configData from "../foundryconfig.json" with { type: "json" };

import { resolveModuleEntryPath } from "./util/config-paths.ts";
import { promptFvttInstall } from "./util/fvtt-install.ts";
import {
    resolveWorldPackPath,
    worldPackFolderName,
} from "./util/resolve-world-pack-path.ts";

function directoryContainsJson(dir: string): boolean {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".json") {
            return true;
        }
        if (entry.isDirectory() && directoryContainsJson(full)) return true;
    }
    return false;
}

const modulesWithWorldPacks = configData.modules.filter(
    (m) =>
        Array.isArray(m.foundryWorldPackPaths) &&
        m.foundryWorldPackPaths.length > 0,
);

if (modulesWithWorldPacks.length === 0) {
    console.log(
        'No modules define non-empty "foundryWorldPackPaths" in foundryconfig.json.',
    );
    process.exit(0);
}

const install = await promptFvttInstall();
if (!install) {
    process.exit(0);
}

const { dataPath, versionKey } = install;

const actionResponse = await prompts({
    type: "select",
    name: "action",
    message: `Pack / unpack world compendiums (Foundry ${versionKey}, dataPath: ${dataPath})`,
    choices: [
        {
            title: "Pack — compile src/packs/<folder>/ → world Data/.../packs/<folder>/",
            value: "pack",
        },
        {
            title: "Unpack — extract world Data/.../packs/<folder>/ → src/packs/<folder>/",
            value: "unpack",
        },
    ],
});

if (!actionResponse.action) {
    console.log("No action selected. Exiting...");
    process.exit(0);
}

const moduleDirs = modulesWithWorldPacks.map(resolveModuleEntryPath);

const choices = [
    { title: "All modules with foundryWorldPackPaths", value: "all" },
    ...moduleDirs.map((dir) => ({
        title: path.basename(dir),
        value: dir,
        selected: false,
    })),
];

const moduleResponse = await prompts({
    type: "multiselect",
    name: "directories",
    message:
        "Select which modules to run against (use spacebar to select/deselect):",
    choices,
});

if (!moduleResponse.directories || moduleResponse.directories.length === 0) {
    console.log("No selection made. Exiting...");
    process.exit(0);
}

const directoriesToProcess = moduleResponse.directories.includes("all")
    ? moduleDirs
    : moduleResponse.directories;

const errors: { module: string; detail: string; error: unknown }[] = [];

for (const moduleRoot of directoriesToProcess) {
    const entry = modulesWithWorldPacks.find(
        (m) => resolveModuleEntryPath(m) === moduleRoot,
    );
    if (!entry?.foundryWorldPackPaths) continue;

    console.log(`\n--- ${path.basename(moduleRoot)} ---`);

    const seenLocalNames = new Set<string>();
    let moduleHadError = false;

    for (const rel of entry.foundryWorldPackPaths) {
        const worldPackAbs = resolveWorldPackPath(dataPath, rel);
        const folderName = worldPackFolderName(rel);
        const localPackDir = path.join(moduleRoot, "src", "packs", folderName);

        if (seenLocalNames.has(folderName)) {
            console.warn(
                `Skipping duplicate src/packs target "${folderName}" (path: ${rel}). Use unique compendium folder names.`,
            );
            continue;
        }
        seenLocalNames.add(folderName);

        try {
            if (actionResponse.action === "unpack") {
                if (!fs.existsSync(worldPackAbs)) {
                    throw new Error(
                        `World pack not found (unpack source): ${worldPackAbs}`,
                    );
                }
                if (!fs.statSync(worldPackAbs).isDirectory()) {
                    throw new Error(
                        `Expected a LevelDB directory at: ${worldPackAbs}`,
                    );
                }
                fs.mkdirSync(path.dirname(localPackDir), { recursive: true });
                console.log(
                    `\n  extractPack\n    src:  ${worldPackAbs}\n    dest: ${localPackDir}`,
                );
                await extractPack(worldPackAbs, localPackDir, {
                    nedb: false,
                    yaml: false,
                    log: true,
                    clean: true,
                });
            } else {
                if (!directoryContainsJson(localPackDir)) {
                    throw new Error(
                        `No JSON under pack source (create or unpack first): ${localPackDir}`,
                    );
                }
                fs.mkdirSync(worldPackAbs, { recursive: true });
                console.log(
                    `\n  compilePack\n    src:  ${localPackDir}\n    dest: ${worldPackAbs}`,
                );
                await compilePack(localPackDir, worldPackAbs, {
                    nedb: false,
                    yaml: false,
                    recursive: true,
                    log: true,
                });
            }
        } catch (error) {
            moduleHadError = true;
            errors.push({
                module: path.basename(moduleRoot),
                detail: rel,
                error,
            });
            console.error(`Failed for path "${rel}":`, error);
        }
    }

    if (!moduleHadError) {
        console.log(`Finished ${path.basename(moduleRoot)}`);
    }
}

if (errors.length > 0) {
    console.log("\nErrors:");
    for (const { module, detail, error } of errors) {
        console.error(`\n${module} (${detail}):`, error);
    }
    process.exit(1);
}

console.log(
    `\nDone (${actionResponse.action === "pack" ? "pack" : "unpack"} on ${directoriesToProcess.length} module(s)).`,
);
