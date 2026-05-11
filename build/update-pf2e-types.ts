import { exec } from "child_process";

import foundryConfig from "../foundryconfig.json" with { type: "json" };

const { pf2eRepoPath, pf2eBranch } = foundryConfig;

exec(`cd ${pf2eRepoPath} && git checkout ${pf2eBranch} && git pull`);
