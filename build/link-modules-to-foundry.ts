import fs from "fs";
import path from "path";
import process from "process";
import prompts from "prompts";

// @ts-expect-error - This is a JSON file, not a TypeScript file
import { dataPath, modules } from "../foundryconfig.json";

if (!dataPath || !/\bData$/.test(dataPath)) {
    console.error(`"${dataPath}" does not look like a Foundry data folder.`);
    process.exit(1);
}

const dataPathStats = fs.lstatSync(dataPath, { throwIfNoEntry: false });

if (!dataPathStats?.isDirectory()) {
    console.error(`No folder found at "${dataPath}"`);
    process.exit(1);
}

const parentDir = path.resolve(process.cwd(), "..");
const moduleDirs = modules.map((mod) => path.resolve(parentDir, mod));

console.log(`Found ${moduleDirs.length} modules in config`);

const choices = [
    { title: "All modules", value: "all" },
    ...moduleDirs.map((dir) => ({
        title: path.basename(dir),
        value: dir,
        selected: false,
    })),
];

const response = await prompts({
    type: "multiselect",
    name: "directories",
    message:
        "Select which modules to link (use spacebar to select/deselect):",
    choices,
});

if (!response.directories || response.directories.length === 0) {
    console.log("No selection made. Exiting...");
    process.exit(0);
}

const directoriesToProcess = response.directories.includes("all")
    ? moduleDirs
    : response.directories;

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

    const symlinkPath = path.resolve(dataPath, "modules", moduleId);
    const symlinkStats = fs.lstatSync(symlinkPath, { throwIfNoEntry: false });

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
