import path from "path";
import prompts from "prompts";
import { execSync } from "child_process";

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
    message: "Select which modules to stage (use spacebar to select/deselect):",
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
        // Run stage in the module directory
        console.log(`Running stage in ${path.basename(dir)}...`);
        execSync("npm run stage", { cwd: dir, stdio: "inherit" });
        console.log(`Successfully ran stage in ${path.basename(dir)}`);
    } catch (error) {
        errors.push({ module: path.basename(dir), error: error as Error });
    }
}

// Print summary at the end
if (errors.length > 0) {
    console.log("\nErrors encountered during staging:");
    errors.forEach(({ module, error }) => {
        console.log(`\n${module}:`);
        console.error(error);
    });
    process.exit(1);
} else {
    console.log("\nSuccessfully staged all selected modules");
}
