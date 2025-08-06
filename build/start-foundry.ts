import fs from "fs-extra";
import path from "path";
import process from "process";
import prompts from "prompts";

// @ts-expect-error - This is a JSON file, not a TypeScript file
import { dataPath, fvtt } from "../foundryconfig.json";

import { exec } from "child_process";
import { promisify } from "util";

const fvttKeys = Object.keys(fvtt);
let fvttVersion: string;

if (fvttKeys.length === 1) {
    // Auto-select if there's only one key
    fvttVersion = fvttKeys[0];
    console.log(`Auto-selected FoundryVTT version: ${fvttVersion}`);
} else {
    // Prompt user if there are multiple keys
    fvttVersion = (
        await prompts({
            type: "select",
            name: "value",
            message: "Select the FoundryVTT version you want to use.",
            choices: fvttKeys.map((version) => ({
                title: version,
                value: version,
            })),
        })
    ).value as string;
}

const fvttPath = fvtt[fvttVersion as keyof typeof fvtt];

if (!fvttPath) {
    console.error(`FoundryVTT version "${fvttVersion}" not found.`);
    process.exit(1);
}

if (!dataPath || !/\bData$/.test(dataPath)) {
    console.error(`"${dataPath}" does not look like a Foundry data folder.`);
    process.exit(1);
}

const execPath = path.resolve(fvttPath, "App", "Foundry Virtual Tabletop.exe");
const nodeEntryPoint = path.resolve(fvttPath, "main.js");
const oldNodeEntryPoint = path.resolve(fvttPath, "resources", "app", "main.js");

const execAsync = promisify(exec);

const startFoundry = async () => {
    try {
        if (fs.existsSync(execPath)) {
            console.log(`Starting FoundryVTT from ${execPath}...`);
            console.log(
                "Make sure to close FoundryVTT instead of using Ctrl-C to stop it.",
            );

            const quotedPath = `"${execPath}"`;
            const { stdout, stderr } = await execAsync(quotedPath);

            console.log(`stdout: ${stdout}`);

            if (stderr) console.error(`stderr: ${stderr}`);
        } else if (fs.existsSync(nodeEntryPoint)) {
            console.log(`Starting FoundryVTT from ${nodeEntryPoint}...`);

            const { stdout, stderr } = await execAsync(
                `node ${nodeEntryPoint} --datapath=${dataPath}`,
            );

            console.log(`stdout: ${stdout}`);

            if (stderr) console.error(`stderr: ${stderr}`);
        } else if (fs.existsSync(oldNodeEntryPoint)) {
            console.log(`Starting FoundryVTT from ${oldNodeEntryPoint}...`);

            const { stdout, stderr } = await execAsync(
                `node ${oldNodeEntryPoint} --datapath=${dataPath}`,
            );

            console.log(`stdout: ${stdout}`);

            if (stderr) console.error(`stderr: ${stderr}`);
        } else {
            console.error(
                `Cannot start FoundryVTT. "${nodeEntryPoint}" or "${execPath}" or "${oldNodeEntryPoint}" do not exist.`,
            );
            process.exit(1);
        }
    } catch (error) {
        console.error(error);
    }
};

startFoundry().catch(console.error);
