import fs from "fs";
import path from "path";
import process from "process";
import prompts from "prompts";

import configData from "../foundryconfig.json" with { type: "json" };

import { allResolvedModuleDirs } from "./util/config-paths.ts";
import { promptFvttInstall } from "./util/fvtt-install.ts";
import { promptModuleDirs } from "./util/select-modules.ts";

const install = await promptFvttInstall();
if (!install) {
    process.exit(0);
}

const { dataPath } = install;

if (!dataPath || /\bData$/.test(dataPath)) {
    console.error(`You should point the dataPath to the location that will contain the Data folder, not the Data folder itself.`);
    process.exit(1);
}

const dataPathStats = fs.lstatSync(dataPath, { throwIfNoEntry: false });

if (!dataPathStats?.isDirectory()) {
    console.error(`No folder found at "${dataPath}"`);
    process.exit(1);
}

// Create the Data and modules folders if they don't exist
const modulesDir = path.resolve(dataPath, "Data", "modules");
fs.mkdirSync(modulesDir, { recursive: true });

const moduleDirs = allResolvedModuleDirs(configData.modules);

console.log(`Found ${moduleDirs.length} modules in config`);

const directoriesToProcess = await promptModuleDirs(moduleDirs, "Select which modules to link");

type Failure = { module: string; reason: string };

const failures: Failure[] = [];
let linkedCount = 0;

for (const moduleRoot of directoriesToProcess) {
    const moduleName = path.basename(moduleRoot);
    console.log(`\nProcessing ${moduleName}...`);

    const moduleJsonPath = path.join(moduleRoot, "static", "module.json");
    let moduleId: string;
    try {
        const raw = fs.readFileSync(moduleJsonPath, "utf8");
        const parsed = JSON.parse(raw) as { id?: unknown };
        if (typeof parsed.id !== "string" || !parsed.id) {
            failures.push({
                module: moduleName,
                reason: `Missing or invalid "id" in ${moduleJsonPath}`,
            });
            continue;
        }
        moduleId = parsed.id;
    } catch {
        failures.push({
            module: moduleName,
            reason: `Could not read ${moduleJsonPath}`,
        });
        continue;
    }

    const distPath = path.join(moduleRoot, "dist");
    const distStats = fs.lstatSync(distPath, { throwIfNoEntry: false });
    if (!distStats?.isDirectory()) {
        failures.push({
            module: moduleName,
            reason: `No "dist" folder at ${distPath}. Build or stage the module first.`,
        });
        continue;
    }

    const symlinkPath = path.resolve(dataPath, "Data", "modules", moduleId);
    const symlinkStats = fs.lstatSync(symlinkPath, { throwIfNoEntry: false });

    const isAlreadyLinked =
        symlinkStats?.isSymbolicLink() &&
        path.resolve(path.dirname(symlinkPath), fs.readlinkSync(symlinkPath)) === distPath;
    if (isAlreadyLinked) {
        console.log(`${moduleName} is already linked.`);
        continue;
    }

    if (symlinkStats) {
        const atPath = symlinkStats.isDirectory()
            ? "folder"
            : symlinkStats.isSymbolicLink()
              ? "symlink"
              : "file";
        const proceed: boolean = (
            await prompts({
                type: "confirm",
                name: "value",
                initial: false,
                message: `A "${moduleId}" ${atPath} already exists in the "modules" subfolder. Replace with new symlink?`,
            })
        ).value;

        if (!proceed) {
            console.log(`Skipping ${moduleName}.`);
            continue;
        }
    }

    try {
        if (symlinkStats?.isDirectory()) {
            fs.rmSync(symlinkPath, { recursive: true, force: true });
        } else if (symlinkStats) {
            fs.unlinkSync(symlinkPath);
        }
        fs.symlinkSync(distPath, symlinkPath);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : String(error);
        failures.push({
            module: moduleName,
            reason: `Symlink failed: ${message}`,
        });
        continue;
    }

    console.log(`Symlink successfully created at "${symlinkPath}"!`);
    linkedCount += 1;
}

if (failures.length > 0) {
    console.log("\nErrors:");
    failures.forEach(({ module, reason }) => {
        console.log(`\n${module}: ${reason}`);
    });
    process.exit(1);
}

if (linkedCount === 0) {
    console.log("\nNo symlinks were created.");
} else {
    console.log("\nSuccessfully linked all selected modules.");
}
