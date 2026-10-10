import fs from "fs";
import path from "path";
import process from "process";

import { spawn } from "child_process";

import { promptFvttInstall } from "./util/fvtt-install.ts";

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

const execPath = path.resolve(appLocation, "App", "Foundry Virtual Tabletop.exe");
const nodeEntryPoint = path.resolve(appLocation, "main.js");
const oldNodeEntryPoint = path.resolve(appLocation, "resources", "app", "main.js");

const dataPathArg = `--dataPath=${dataPath}`;

let command: string;
let args: string[];

if (fs.existsSync(execPath)) {
    console.log(`Starting FoundryVTT from ${execPath}...`);
    console.log("Make sure to close FoundryVTT instead of using Ctrl-C to stop it.");
    command = execPath;
    args = [dataPathArg];
} else if (fs.existsSync(nodeEntryPoint)) {
    console.log(`Starting FoundryVTT from ${nodeEntryPoint}...`);
    console.log(`Likely available at http://localhost:30000. Ctrl-C to stop.`);
    command = process.execPath;
    args = [nodeEntryPoint, dataPathArg];
} else if (fs.existsSync(oldNodeEntryPoint)) {
    console.log(`Starting FoundryVTT from ${oldNodeEntryPoint}...`);
    command = process.execPath;
    args = [oldNodeEntryPoint, dataPathArg];
} else {
    console.error(
        `Cannot start FoundryVTT. "${nodeEntryPoint}" and "${execPath}" and "${oldNodeEntryPoint}" do not exist.`,
    );
    process.exit(1);
}

const foundry = spawn(command, args, { stdio: "inherit" });

foundry.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
});

foundry.on("exit", (code) => {
    process.exitCode = code ?? 0;
});
