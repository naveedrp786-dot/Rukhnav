"use strict";

const { spawn } = require("child_process");
const path = require("path");

const backendRoot = path.resolve(__dirname, "..");

function runNode(script, args = []) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            [script, ...args],
            {
                cwd: backendRoot,
                env: process.env,
                stdio: "inherit"
            }
        );

        child.on("error", reject);

        child.on("exit", code => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(
                new Error(
                    `${path.basename(script)} exited with code ${code}`
                )
            );
        });
    });
}

async function main() {
    console.log("========================================");
    console.log("RUKHNAV PRODUCTION STARTUP");
    console.log("========================================");

    if (process.env.NODE_ENV !== "production") {
        throw new Error(
            "NODE_ENV must equal production."
        );
    }

    if (
        process.env.APP_ENV &&
        process.env.APP_ENV !== "production"
    ) {
        throw new Error(
            "APP_ENV must equal production."
        );
    }

    await runNode(
        path.join(
            backendRoot,
            "scripts",
            "production-readiness.js"
        ),
        ["production"]
    );

    console.log(
        "Production readiness passed. Starting RUKHNAV..."
    );

    const server = spawn(
        process.execPath,
        [
            path.join(
                backendRoot,
                "scripts",
                "start-environment.js"
            ),
            "production"
        ],
        {
            cwd: backendRoot,
            env: process.env,
            stdio: "inherit"
        }
    );

    const forwardSignal = signal => {
        if (!server.killed) {
            server.kill(signal);
        }
    };

    process.on("SIGTERM", () => forwardSignal("SIGTERM"));
    process.on("SIGINT", () => forwardSignal("SIGINT"));

    server.on("exit", code => {
        process.exit(code ?? 0);
    });
}

main().catch(error => {
    console.error(
        "RUKHNAV production startup failed:",
        error.message
    );
    process.exit(1);
});
