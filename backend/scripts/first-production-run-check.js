"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const backendRoot =
    path.resolve(__dirname, "..");

function run(script, args = []) {
    console.log("----------------------------------------");
    console.log(`Running ${script} ${args.join(" ")}`.trim());
    console.log("----------------------------------------");

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
    console.log("RUKHNAV FIRST PRODUCTION RUN CHECK");
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
        "RUKHNAV FIRST PRODUCTION RUN CHECK: PASSED"
    );
    console.log("========================================");
    console.log(
        "The application is ready for its first controlled production start."
    );
} catch (error) {
    console.error("========================================");
    console.error(
        "RUKHNAV FIRST PRODUCTION RUN CHECK: FAILED"
    );
    console.error("========================================");
    console.error(error.message);
    process.exit(1);
}
