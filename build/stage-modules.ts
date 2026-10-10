import path from "path";
import { execSync } from "child_process";

import configData from "../foundryconfig.json" with { type: "json" };

import { allResolvedModuleDirs } from "./util/config-paths.ts";
import { exitOnModuleErrors, promptModuleDirs, type ModuleError } from "./util/select-modules.ts";

const moduleDirs = allResolvedModuleDirs(configData.modules);

console.log(`Found ${moduleDirs.length} modules in config`);

const directoriesToProcess = await promptModuleDirs(moduleDirs, "Select which modules to stage");

const errors: ModuleError[] = [];

for (const dir of directoriesToProcess) {
    console.log(`\nProcessing ${path.basename(dir)}...`);

    try {
        // Run stage in the module directory
        console.log(`Running stage in ${path.basename(dir)}...`);
        execSync("npm run stage", { cwd: dir, stdio: "inherit" });
        console.log(`Successfully ran stage in ${path.basename(dir)}`);
    } catch (error) {
        errors.push({ module: path.basename(dir), error });
    }
}

exitOnModuleErrors(errors, "Errors encountered during staging:");
console.log("\nSuccessfully staged all selected modules");
