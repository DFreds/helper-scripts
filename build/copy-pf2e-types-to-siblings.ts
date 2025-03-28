import fs from "fs";
import fsExtra from "fs-extra";
import path from "path";
import prompts from "prompts";

// @ts-expect-error - This is a JSON file, not a TypeScript file
import { pf2eRepoPath, modules } from "../foundryconfig.json";

const sourceDataPath = path.resolve(pf2eRepoPath, "types", "foundry");
const parentDir = path.resolve(process.cwd(), "..");

// Verify source directory exists
const sourceRepoPathStats = fs.lstatSync(sourceDataPath, {
    throwIfNoEntry: false,
});
if (!sourceRepoPathStats?.isDirectory()) {
    console.error(`No folder found at ${sourceDataPath}`);
    process.exit(1);
}

// Get all module directories
const moduleDirs = modules.map((mod) => path.resolve(parentDir, mod));

console.log(`Found ${moduleDirs.length} modules in config`);

// Create choices for the prompt
const choices = [
    { title: "All modules", value: "all" },
    ...moduleDirs.map((dir) => ({
        title: path.basename(dir),
        value: dir,
        selected: false,
    })),
];

// Prompt for selection
const response = await prompts({
    type: "multiselect",
    name: "directories",
    message:
        "Select which modules to update (use spacebar to select/deselect):",
    choices,
});

if (!response.directories || response.directories.length === 0) {
    console.log("No selection made. Exiting...");
    process.exit(0);
}

// Process selected directory(ies)
const directoriesToProcess = response.directories.includes("all")
    ? moduleDirs
    : response.directories;

for (const dir of directoriesToProcess) {
    const targetDir = path.resolve(dir, "types", "foundry");
    console.log(`\nProcessing ${path.basename(dir)}...`);

    try {
        // Clean existing types if they exist
        if (fs.existsSync(targetDir)) {
            console.log(`Cleaning ${targetDir}`);
            fsExtra.removeSync(targetDir);
        }

        // Create directory and copy files
        console.log(`Copying types to ${targetDir}`);
        fs.mkdirSync(targetDir, { recursive: true });
        fsExtra.copySync(sourceDataPath, targetDir);
        console.log(`Successfully copied types to ${path.basename(dir)}`);
    } catch (error) {
        console.error(`Error processing ${path.basename(dir)}:`, error);
    }
}

console.log("\nFinished copying types to selected modules");
