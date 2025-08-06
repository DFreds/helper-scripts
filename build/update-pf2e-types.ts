import { exec } from "child_process";

// @ts-expect-error - This is a JSON file, not a TypeScript file
import { pf2eRepoPath } from "../foundryconfig.json" with { type: "json" };

exec(`cd ${pf2eRepoPath} && git checkout v13-dev && git pull`);
