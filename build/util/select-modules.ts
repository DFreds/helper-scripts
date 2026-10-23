import path from "path";
import prompts from "prompts";

/**
 * Asks which of `moduleDirs` to run against, with an "All modules" option.
 * Returns every module without asking when the script is run with `--all`.
 * Exits the process if nothing is selected.
 */
export async function promptModuleDirs(moduleDirs: string[], message: string): Promise<string[]> {
    if (process.argv.includes("--all")) return moduleDirs;

    const response = await prompts({
        type: "multiselect",
        name: "directories",
        message: `${message} (use spacebar to select/deselect):`,
        choices: [
            { title: "All modules", value: "all" },
            ...moduleDirs.map((dir) => ({ title: path.basename(dir), value: dir })),
        ],
    });

    const selected: string[] = response.directories ?? [];
    if (selected.length === 0) {
        console.log("No selection made. Exiting...");
        process.exit(0);
    }

    return selected.includes("all") ? moduleDirs : selected;
}

export type ModuleError = { module: string; error: unknown };

/** Prints each module's error under `heading` and exits with code 1. Does nothing if there are no errors. */
export function exitOnModuleErrors(errors: ModuleError[], heading: string): void {
    if (errors.length === 0) return;

    console.log(`\n${heading}`);
    for (const { module, error } of errors) {
        console.log(`\n${module}:`);
        console.error(error);
    }
    process.exit(1);
}
