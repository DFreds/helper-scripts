import prompts from "prompts";

// @ts-expect-error - This is a JSON file, not a TypeScript file
import { fvtt } from "../foundryconfig.json";

export type FvttInstall = {
    versionKey: string;
    appLocation: string;
    dataPath: string;
};

function isFvttEntry(
    v: unknown,
): v is { appLocation: string; dataPath: string } {
    return (
        typeof v === "object" &&
        v !== null &&
        typeof (v as { appLocation?: unknown }).appLocation === "string" &&
        typeof (v as { dataPath?: unknown }).dataPath === "string"
    );
}

/**
 * Prompts for a Foundry install when multiple are configured, or auto-selects
 * the only entry. Returns null if the user cancels or the config is invalid.
 */
export async function promptFvttInstall(): Promise<FvttInstall | null> {
    const fvttKeys = Object.keys(fvtt);
    if (fvttKeys.length === 0) {
        console.error(
            "No FoundryVTT installs configured under fvtt in foundryconfig.json.",
        );
        return null;
    }

    let versionKey: string;

    if (fvttKeys.length === 1) {
        versionKey = fvttKeys[0];
        console.log(`Auto-selected FoundryVTT version: ${versionKey}`);
    } else {
        const response = await prompts({
            type: "select",
            name: "value",
            message: "Select the FoundryVTT version you want to use.",
            choices: fvttKeys.map((version) => ({
                title: version,
                value: version,
            })),
        });
        if (response.value === undefined || response.value === null) {
            console.log("No selection made. Exiting...");
            return null;
        }
        versionKey = response.value as string;
    }

    const entry = fvtt[versionKey as keyof typeof fvtt];
    if (!isFvttEntry(entry)) {
        console.error(
            `Invalid fvtt entry for "${versionKey}": expected appLocation and dataPath.`,
        );
        return null;
    }

    return {
        versionKey,
        appLocation: entry.appLocation,
        dataPath: entry.dataPath,
    };
}
