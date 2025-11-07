import fs from "fs";
import fsExtra from "fs-extra";
import path from "path";
import prompts from "prompts";
import { execSync } from "child_process";

import configData from "../foundryconfig.json" with { type: "json" };

const parentDir = path.resolve(process.cwd(), "..");

// Define type configurations
const typeConfigs = {
    pf2e: {
        name: "PF2e Types",
        sourcePath: path.resolve(configData.pf2eRepoPath, "types", "foundry"),
        targetSubdir: "foundry",
        moduleList: configData.modules,
        runLint: false,
    },
    uiExtender: {
        name: "UI Extender Types",
        sourcePath: path.resolve(configData.uiExtenderRepoPath, "types", "uiExtender"),
        targetSubdir: "uiExtender",
        moduleList: configData.uiExtenderModules,
        runLint: true,
    },
    migration: {
        name: "Migration Types",
        sourcePath: path.resolve(configData.migrationsRepoPath, "types", "migrations"),
        targetSubdir: "migrations",
        moduleList: configData.migrationModules,
        runLint: false,
    },
};

// First prompt: Select type to update
const typeResponse = await prompts({
    type: "select",
    name: "type",
    message: "Select which types to update:",
    choices: [
        { title: "PF2e Types", value: "pf2e" },
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
const moduleDirs = config.moduleList.map((mod) => path.resolve(parentDir, mod));

console.log(`Found ${moduleDirs.length} modules for ${config.name} in config`);

// Create choices for the prompt
const choices = [
    { title: "All modules", value: "all" },
    ...moduleDirs.map((dir) => ({
        title: path.basename(dir),
        value: dir,
        selected: false,
    })),
];

// Prompt for module selection
const moduleResponse = await prompts({
    type: "multiselect",
    name: "directories",
    message: `Select which modules to update with ${config.name} (use spacebar to select/deselect):`,
    choices,
});

if (!moduleResponse.directories || moduleResponse.directories.length === 0) {
    console.log("No selection made. Exiting...");
    process.exit(0);
}

// Process selected directory(ies)
const directoriesToProcess = moduleResponse.directories.includes("all")
    ? moduleDirs
    : moduleResponse.directories;

const errors: { module: string; error: any }[] = [];

for (const dir of directoriesToProcess) {
    const targetDir = path.resolve(dir, "types", config.targetSubdir);
    console.log(`\nProcessing ${path.basename(dir)}...`);

    try {
        // Clean existing types if they exist
        if (fs.existsSync(targetDir)) {
            console.log(`Cleaning ${targetDir}`);
            fsExtra.removeSync(targetDir);
        }

        // Create directory and copy files
        console.log(`Copying ${config.name} to ${targetDir}`);
        fs.mkdirSync(targetDir, { recursive: true });
        fsExtra.copySync(sourceDataPath, targetDir);
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

// Print all errors at the end if any occurred
if (errors.length > 0) {
    console.log("\nErrors encountered during processing:");
    errors.forEach(({ module, error }) => {
        console.error(`\nError in module ${module}:`);
        console.error(error);
    });
}

const lintMessage = config.runLint ? " and running lint:fix" : "";
console.log(
    `\nFinished copying ${config.name}${lintMessage} on selected modules`,
);
