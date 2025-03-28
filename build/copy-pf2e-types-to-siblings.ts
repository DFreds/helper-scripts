import fs from "fs";
import fsExtra from "fs-extra";
import path from "path";
import prompts from "prompts";

// @ts-expect-error - This is a JSON file, not a TypeScript file
import { pf2eRepoPath } from "../foundryconfig.json";

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

// Get all sibling directories
const siblingDirs = fs
    .readdirSync(parentDir)
    .filter((dir) => dir.startsWith("dfreds-"))
    .map((dir) => path.resolve(parentDir, dir));

console.log(`Found ${siblingDirs.length} dfreds- prefixed directories`);

// Create choices for the prompt
const choices = [
    { title: "All directories", value: "all" },
    ...siblingDirs.map((dir) => ({
        title: path.basename(dir),
        value: dir,
    })),
];

// Prompt for selection
const response = await prompts({
    type: "select",
    name: "directory",
    message: "Select which directory to update:",
    choices,
});

if (!response.directory) {
    console.log("No selection made. Exiting...");
    process.exit(0);
}

// Process selected directory(ies)
const directoriesToProcess =
    response.directory === "all" ? siblingDirs : [response.directory];

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

console.log("\nFinished copying types to selected directories");
