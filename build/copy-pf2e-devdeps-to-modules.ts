import fs from "fs";
import path from "path";
import prompts from "prompts";
import { execSync } from "child_process";

import configData from "../foundryconfig.json" with { type: "json" };

import { resolveModulePath } from "./config-paths.js";

type PackageJson = Record<string, unknown> & {
    name?: string;
    version?: string;
    devDependencies?: Record<string, string>;
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("-n");

const pf2ePackageJsonPath = path.resolve(configData.pf2eRepoPath, "package.json");
const pf2ePackageJsonRaw = fs.readFileSync(pf2ePackageJsonPath, "utf-8");
const pf2ePackageJson = JSON.parse(pf2ePackageJsonRaw) as PackageJson;

const pf2eDevDependencies = pf2ePackageJson.devDependencies;
if (!pf2eDevDependencies || Object.keys(pf2eDevDependencies).length === 0) {
    console.error(`No devDependencies found in ${pf2ePackageJsonPath}`);
    process.exit(1);
}

// Get all module directories
const moduleDirs = configData.modules.map((mod) => resolveModulePath(mod));

console.log(`Loaded ${Object.keys(pf2eDevDependencies).length} PF2e devDependencies`);
console.log(`Found ${moduleDirs.length} modules in config`);
if (dryRun)
    console.log(
        "Running in dry-run mode (no files will be written / deleted, and no installs will run)",
    );

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
        "Select which repos to copy PF2e devDependencies into (use spacebar to select/deselect):",
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

const copyErrors: { module: string; error: Error }[] = [];
let updatedCount = 0;

for (const dir of directoriesToProcess) {
    const moduleName = path.basename(dir);
    console.log(`\nProcessing ${moduleName}...`);

    try {
        const targetPackageJsonPath = path.resolve(dir, "package.json");
        if (!fs.existsSync(targetPackageJsonPath)) {
            throw new Error(`No package.json found at ${targetPackageJsonPath}`);
        }

        const targetRaw = fs.readFileSync(targetPackageJsonPath, "utf-8");
        const targetJson = JSON.parse(targetRaw) as PackageJson;

        targetJson.devDependencies = { ...pf2eDevDependencies };

        if (dryRun) {
            console.log(
                `Would update devDependencies in ${moduleName}/package.json (overwrite)`,
            );
        } else {
            fs.writeFileSync(
                targetPackageJsonPath,
                `${JSON.stringify(targetJson, null, 4)}\n`,
                "utf-8",
            );
            console.log(`Updated devDependencies in ${moduleName}/package.json`);
        }

        updatedCount += 1;
    } catch (error) {
        copyErrors.push({ module: moduleName, error: error as Error });
    }
}

// Print copy summary at the end
console.log(
    `\n${dryRun ? "Dry-run" : "Finished"}: copied devDependencies to ${updatedCount} repo(s)`,
);

if (copyErrors.length > 0) {
    console.log("\nErrors encountered while copying devDependencies:");
    copyErrors.forEach(({ module, error }) => {
        console.log(`\n${module}:`);
        console.error(error);
    });
    process.exit(1);
}

if (dryRun) {
    console.log("\nDry-run complete.");
    process.exit(0);
}

// Now delete node_modules + package-lock.json and reinstall for the same repos
const reinstallErrors: { module: string; error: Error }[] = [];

for (const dir of directoriesToProcess) {
    const moduleName = path.basename(dir);
    console.log(`\nCleaning and reinstalling in ${moduleName}...`);

    try {
        const packageLockPath = path.join(dir, "package-lock.json");
        if (fs.existsSync(packageLockPath)) {
            console.log(`Deleting package-lock.json in ${moduleName}...`);
            fs.unlinkSync(packageLockPath);
        } else {
            console.log(`No package-lock.json found in ${moduleName}`);
        }

        const nodeModulesPath = path.join(dir, "node_modules");
        if (fs.existsSync(nodeModulesPath)) {
            console.log(`Deleting node_modules folder in ${moduleName}...`);
            fs.rmSync(nodeModulesPath, { recursive: true, force: true });
        } else {
            console.log(`No node_modules folder found in ${moduleName}`);
        }

        console.log(`Running npm install in ${moduleName}...`);
        execSync("npm install", { cwd: dir, stdio: "inherit" });
        console.log(`Successfully ran npm install in ${moduleName}`);
    } catch (error) {
        reinstallErrors.push({ module: moduleName, error: error as Error });
    }
}

if (reinstallErrors.length > 0) {
    console.log("\nErrors encountered during cleanup and reinstall:");
    reinstallErrors.forEach(({ module, error }) => {
        console.log(`\n${module}:`);
        console.error(error);
    });
    process.exit(1);
}

console.log("\nSuccessfully copied devDependencies, cleaned, and reinstalled all selected repos");
