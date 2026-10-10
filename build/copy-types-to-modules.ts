import fs from "fs";
import path from "path";
import prompts from "prompts";
import { execSync } from "child_process";

import configData from "../foundryconfig.json" with { type: "json" };

import { resolveModulePath } from "./util/config-paths.ts";
import { exitOnModuleErrors, promptModuleDirs, type ModuleError } from "./util/select-modules.ts";

const uiExtenderModulePaths = configData.modules
    .filter((m) => m.hasUiExtenderTypes)
    .map((m) => m.path);
const migrationModulePaths = configData.modules
    .filter((m) => m.hasMigrationTypes)
    .map((m) => m.path);

// Define type configurations
const typeConfigs = {
    uiExtender: {
        name: "UI Extender Types",
        sourcePath: path.join(resolveModulePath(configData.uiExtenderRepoPath), "types", "uiExtender"),
        targetSubdir: "uiExtender",
        modulePaths: uiExtenderModulePaths,
        runLint: true,
    },
    migration: {
        name: "Migration Types",
        sourcePath: path.join(resolveModulePath(configData.migrationsRepoPath), "types", "migrations"),
        targetSubdir: "migrations",
        modulePaths: migrationModulePaths,
        runLint: false,
    },
};

// First prompt: Select type to update
const typeResponse = await prompts({
    type: "select",
    name: "type",
    message: "Select which types to update:",
    choices: [
        { title: "UI Extender Types", value: "uiExtender" },
        { title: "Migration Types", value: "migration" },
    ],
});

if (!typeResponse.type) {
    console.log("No type selected. Exiting...");
    process.exit(0);
}

const config = typeConfigs[typeResponse.type as keyof typeof typeConfigs];
const sourceDataPath = config.sourcePath;

// Verify source directory exists
const sourceRepoPathStats = fs.lstatSync(sourceDataPath, {
    throwIfNoEntry: false,
});
if (!sourceRepoPathStats?.isDirectory()) {
    console.error(`No folder found at ${sourceDataPath}`);
    process.exit(1);
}

// Get all module directories
const moduleDirs = config.modulePaths.map((mod) => resolveModulePath(mod));

console.log(`Found ${moduleDirs.length} modules for ${config.name} in config`);

const directoriesToProcess = await promptModuleDirs(moduleDirs, `Select which modules to update with ${config.name}`);

const errors: ModuleError[] = [];

for (const dir of directoriesToProcess) {
    const targetDir = path.resolve(dir, "types", config.targetSubdir);
    console.log(`\nProcessing ${path.basename(dir)}...`);

    try {
        // Clean existing types if they exist
        if (fs.existsSync(targetDir)) {
            console.log(`Cleaning ${targetDir}`);
            fs.rmSync(targetDir, { recursive: true, force: true });
        }

        // Create directory and copy files
        console.log(`Copying ${config.name} to ${targetDir}`);
        fs.cpSync(sourceDataPath, targetDir, { recursive: true });
        console.log(
            `Successfully copied ${config.name} to ${path.basename(dir)}`,
        );

        // Run lint:fix if configured
        if (config.runLint) {
            console.log(`Running lint:fix in ${path.basename(dir)}...`);
            execSync("npm run lint:fix", { cwd: dir, stdio: "inherit" });
            console.log(`Successfully ran lint:fix in ${path.basename(dir)}`);
        }
    } catch (error) {
        errors.push({ module: path.basename(dir), error });
        console.log(`Failed to process ${path.basename(dir)}`);
    }
}

exitOnModuleErrors(errors, "Errors encountered during processing:");

const lintMessage = config.runLint ? " and running lint:fix" : "";
console.log(
    `\nFinished copying ${config.name}${lintMessage} on selected modules`,
);
