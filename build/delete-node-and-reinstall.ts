import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import prompts from "prompts";

// @ts-expect-error - This is a JSON file, not a TypeScript file
import { modules } from "../foundryconfig.json";

const parentDir = path.resolve(process.cwd(), "..");

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
        "Select which modules to clean and reinstall (use spacebar to select/deselect):",
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

const errors: { module: string; error: Error }[] = [];

for (const dir of directoriesToProcess) {
    console.log(`\nProcessing ${path.basename(dir)}...`);

    try {
        // Delete package-lock.json if it exists
        const packageLockPath = path.join(dir, "package-lock.json");
        if (fs.existsSync(packageLockPath)) {
            console.log(
                `Deleting package-lock.json in ${path.basename(dir)}...`,
            );
            fs.unlinkSync(packageLockPath);
            console.log(
                `Successfully deleted package-lock.json in ${path.basename(dir)}`,
            );
        } else {
            console.log(`No package-lock.json found in ${path.basename(dir)}`);
        }

        // Delete node_modules folder if it exists
        const nodeModulesPath = path.join(dir, "node_modules");
        if (fs.existsSync(nodeModulesPath)) {
            console.log(
                `Deleting node_modules folder in ${path.basename(dir)}...`,
            );
            fs.rmSync(nodeModulesPath, { recursive: true, force: true });
            console.log(
                `Successfully deleted node_modules folder in ${path.basename(dir)}`,
            );
        } else {
            console.log(
                `No node_modules folder found in ${path.basename(dir)}`,
            );
        }

        // Run npm install
        console.log(`Running npm install in ${path.basename(dir)}...`);
        execSync("npm install", { cwd: dir, stdio: "inherit" });
        console.log(`Successfully ran npm install in ${path.basename(dir)}`);
    } catch (error) {
        errors.push({ module: path.basename(dir), error: error as Error });
    }
}

// Print summary at the end
if (errors.length > 0) {
    console.log("\nErrors encountered during cleanup and reinstall:");
    errors.forEach(({ module, error }) => {
        console.log(`\n${module}:`);
        console.error(error);
    });
    process.exit(1);
} else {
    console.log("\nSuccessfully cleaned and reinstalled all selected modules");
}
