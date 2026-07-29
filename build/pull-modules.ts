import path from "path";
import prompts from "prompts";
import { execSync } from "child_process";

import configData from "../foundryconfig.json" with { type: "json" };

import { allResolvedModuleDirs } from "./util/config-paths.ts";

const moduleDirs = allResolvedModuleDirs(configData.modules);

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
    message: "Select which modules to pull (use spacebar to select/deselect):",
    choices,
});

if (!response.directories || response.directories.length === 0) {
    console.log("No selection made. Exiting...");
    process.exit(0);
}

// Process selected directory(ies)
const directoriesToProcess = response.directories.includes("all") ? moduleDirs : response.directories;

const errors: { module: string; error: Error }[] = [];
const skipped: { module: string; reason: string }[] = [];

for (const dir of directoriesToProcess) {
    console.log(`\nProcessing ${path.basename(dir)}...`);

    try {
        const branch = execSync("git branch --show-current", {
            cwd: dir,
            encoding: "utf8",
        }).trim();

        if (!branch) {
            skipped.push({
                module: path.basename(dir),
                reason: "detached HEAD, no branch to pull",
            });
            console.log(`Skipping ${path.basename(dir)} - detached HEAD, no branch to pull`);
            continue;
        }

        // Skip anything with local changes rather than leaving a failed merge behind
        const status = execSync("git status --porcelain", {
            cwd: dir,
            encoding: "utf8",
        }).trim();

        if (status) {
            skipped.push({
                module: path.basename(dir),
                reason: "uncommitted changes in working tree",
            });
            console.log(`Skipping ${path.basename(dir)} - uncommitted changes in working tree`);
            continue;
        }

        console.log(`Pulling latest changes for branch '${branch}' in ${path.basename(dir)}...`);
        execSync("git pull --ff-only", { cwd: dir, stdio: "inherit" });
        console.log(`Successfully pulled in ${path.basename(dir)}`);
    } catch (error) {
        errors.push({ module: path.basename(dir), error: error as Error });
    }
}

// Print summary at the end
if (skipped.length > 0) {
    console.log("\nSkipped modules:");
    skipped.forEach(({ module, reason }) => {
        console.log(`  ${module}: ${reason}`);
    });
}

if (errors.length > 0) {
    console.log("\nErrors encountered during pull:");
    errors.forEach(({ module, error }) => {
        console.log(`\n${module}:`);
        console.error(error);
    });
    process.exit(1);
} else {
    console.log("\nSuccessfully pulled all selected modules");
}
