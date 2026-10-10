import path from "path";
import { execSync } from "child_process";

import configData from "../foundryconfig.json" with { type: "json" };

import { allResolvedModuleDirs, resolveModulePath } from "./util/config-paths.ts";
import { exitOnModuleErrors, promptModuleDirs, type ModuleError } from "./util/select-modules.ts";

const supplementalRepos: string[] = configData.supplementalRepos ?? [];
const moduleDirs = [...allResolvedModuleDirs(configData.modules), ...supplementalRepos.map(resolveModulePath)];

console.log(`Found ${moduleDirs.length} repos in config`);

const directoriesToProcess = await promptModuleDirs(moduleDirs, "Select which modules to pull");

const errors: ModuleError[] = [];
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
        errors.push({ module: path.basename(dir), error });
    }
}

// Print summary at the end
if (skipped.length > 0) {
    console.log("\nSkipped modules:");
    skipped.forEach(({ module, reason }) => {
        console.log(`  ${module}: ${reason}`);
    });
}

exitOnModuleErrors(errors, "Errors encountered during pull:");
console.log("\nSuccessfully pulled all selected modules");
