import fs from "fs";
import fsExtra from "fs-extra";
import path from "path";
import prompts from "prompts";
import { execSync } from "child_process";

// @ts-expect-error - This is a JSON file, not a TypeScript file
import { uiExtenderRepoPath, uiExtenderModules } from "../foundryconfig.json";

const sourceDataPath = path.resolve(uiExtenderRepoPath, "types", "uiExtender");
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
const moduleDirs = uiExtenderModules.map((mod) => path.resolve(parentDir, mod));

console.log(`Found ${moduleDirs.length} UI Extender modules in config`);

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
        "Select which modules to update with UI Extender types (use spacebar to select/deselect):",
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

const errors: { module: string; error: any }[] = [];

for (const dir of directoriesToProcess) {
    const targetDir = path.resolve(dir, "types", "uiExtender");
    console.log(`\nProcessing ${path.basename(dir)}...`);

    try {
        // Clean existing types if they exist
        if (fs.existsSync(targetDir)) {
            console.log(`Cleaning ${targetDir}`);
            fsExtra.removeSync(targetDir);
        }

        // Create directory and copy files
        console.log(`Copying UI Extender types to ${targetDir}`);
        fs.mkdirSync(targetDir, { recursive: true });
        fsExtra.copySync(sourceDataPath, targetDir);
        console.log(
            `Successfully copied UI Extender types to ${path.basename(dir)}`,
        );

        // Run lint:fix in the module directory
        console.log(`Running lint:fix in ${path.basename(dir)}...`);
        execSync("npm run lint:fix", { cwd: dir, stdio: "inherit" });
        console.log(`Successfully ran lint:fix in ${path.basename(dir)}`);
    } catch (error) {
        errors.push({ module: path.basename(dir), error });
        console.log(`Failed to process ${path.basename(dir)}`);
    }
}

// Print all errors at the end if any occurred
if (errors.length > 0) {
    console.log("\nErrors encountered during processing:");
    errors.forEach(({ module, error }) => {
        console.error(`\nError in module ${module}:`);
        console.error(error);
    });
}

console.log(
    "\nFinished copying UI Extender types and running lint:fix on selected modules",
);
