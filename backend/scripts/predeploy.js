"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const backendRoot =
    path.resolve(__dirname, "..");

function run(script, args = []) {
    const result =
        spawnSync(
            process.execPath,
            [
                path.join(
                    backendRoot,
                    "scripts",
                    script
                ),
                ...args
            ],
            {
                cwd: backendRoot,
                env: process.env,
                stdio: "inherit"
            }
        );

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(
            `${script} failed with exit code ${result.status}`
        );
    }
}

try {
    console.log("========================================");
    console.log("RUKHNAV PRE-DEPLOY VALIDATION");
    console.log("========================================");

    run(
        "cloud-environment-audit.js"
    );

    run(
        "production-readiness.js",
        ["production"]
    );

    run(
        "verify-production-database.js",
        ["production"]
    );

    console.log("========================================");
    console.log(
        "RUKHNAV PRE-DEPLOY VALIDATION: PASSED"
    );
    console.log("========================================");
} catch (error) {
    console.error(
        "RUKHNAV PRE-DEPLOY VALIDATION: FAILED"
    );
    console.error(error.message);
    process.exit(1);
}
