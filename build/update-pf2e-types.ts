import { exec } from "child_process";

// @ts-expect-error - This is a JSON file, not a TypeScript file
import { pf2eRepoPath, pf2eBranch } from "../foundryconfig.json" with { type: "json" };

exec(`cd ${pf2eRepoPath} && git checkout ${pf2eBranch} && git pull`);
