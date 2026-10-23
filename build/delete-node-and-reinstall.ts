import { execSync } from "child_process";
import fs from "fs";
import path from "path";

import configData from "../foundryconfig.json" with { type: "json" };

import { allResolvedModuleDirs } from "./util/config-paths.ts";
import { exitOnModuleErrors, promptModuleDirs, type ModuleError } from "./util/select-modules.ts";

const force = process.argv.includes("--force");
const installCommand = force ? "npm install" : "npm ci";

const moduleDirs = allResolvedModuleDirs(configData.modules);

console.log(`Found ${moduleDirs.length} modules in config`);
console.log(
    force
        ? "Force mode: deleting package-lock.json and running npm install"
        : "Keeping package-lock.json and running npm ci",
);

const directoriesToProcess = await promptModuleDirs(moduleDirs, "Select which modules to clean and reinstall");

const errors: ModuleError[] = [];

for (const dir of directoriesToProcess) {
    console.log(`\nProcessing ${path.basename(dir)}...`);

    try {
        if (force) {
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

        console.log(`Running ${installCommand} in ${path.basename(dir)}...`);
        execSync(installCommand, { cwd: dir, stdio: "inherit" });
        console.log(`Successfully ran ${installCommand} in ${path.basename(dir)}`);
    } catch (error) {
        errors.push({ module: path.basename(dir), error });
    }
}

exitOnModuleErrors(errors, "Errors encountered during cleanup and reinstall:");
console.log("\nSuccessfully cleaned and reinstalled all selected modules");
