import fs from "fs-extra";
import path from "path";
import process from "process";
import { promisify } from "util";

import { exec } from "child_process";

import { promptFvttInstall } from "./fvtt-install.js";

const install = await promptFvttInstall();
if (!install) {
    process.exit(0);
}

const { appLocation, dataPath } = install;

if (!dataPath || /\bData$/.test(dataPath)) {
    console.error(
        `You should point the dataPath to the location that will contain the Data folder, not the Data folder itself.`,
    );
    process.exit(1);
}

const execPath = path.resolve(
    appLocation,
    "App",
    "Foundry Virtual Tabletop.exe",
);
const nodeEntryPoint = path.resolve(appLocation, "main.js");
const oldNodeEntryPoint = path.resolve(
    appLocation,
    "resources",
    "app",
    "main.js",
);

const execAsync = promisify(exec);

const startFoundry = async () => {
    try {
        if (fs.existsSync(execPath)) {
            console.log(`Starting FoundryVTT from ${execPath}...`);
            console.log(
                "Make sure to close FoundryVTT instead of using Ctrl-C to stop it.",
            );

            const quotedPath = `"${execPath}" --dataPath=${dataPath}`;
            const { stdout, stderr } = await execAsync(quotedPath);

            console.log(`stdout: ${stdout}`);

            if (stderr) console.error(`stderr: ${stderr}`);
        } else if (fs.existsSync(nodeEntryPoint)) {
            console.log(`Starting FoundryVTT from ${nodeEntryPoint}...`);
            console.log(
                `Likely available at http://localhost:30000. Ctrl-C to stop.`,
            );

            const { stdout, stderr } = await execAsync(
                `node ${nodeEntryPoint} --dataPath=${dataPath}`,
            );

            console.log(`stdout: ${stdout}`);

            if (stderr) console.error(`stderr: ${stderr}`);
        } else if (fs.existsSync(oldNodeEntryPoint)) {
            console.log(`Starting FoundryVTT from ${oldNodeEntryPoint}...`);

            const { stdout, stderr } = await execAsync(
                `node ${oldNodeEntryPoint} --dataPath=${dataPath}`,
            );

            console.log(`stdout: ${stdout}`);

            if (stderr) console.error(`stderr: ${stderr}`);
        } else {
            console.error(
                `Cannot start FoundryVTT. "${nodeEntryPoint}" and "${execPath}" and "${oldNodeEntryPoint}" do not exist.`,
            );
            process.exit(1);
        }
    } catch (error) {
        console.error(error);
    }
};

startFoundry().catch(console.error);
