"use strict";

const fs = require("fs");
const path = require("path");

const backendRoot =
    path.resolve(
        __dirname,
        ".."
    );

const packagePath =
    path.join(
        backendRoot,
        "package.json"
    );

if (!fs.existsSync(packagePath)) {
    throw new Error(
        `package.json was not found at ${packagePath}`
    );
}

const backupPath =
    `${packagePath}.before-environment-setup`;

if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(
        packagePath,
        backupPath
    );
}

const packageJson =
    JSON.parse(
        fs.readFileSync(
            packagePath,
            "utf8"
        )
    );

packageJson.scripts =
    packageJson.scripts || {};

packageJson.scripts.dev =
    "nodemon scripts/start-environment.js development";

packageJson.scripts.staging =
    "node scripts/start-environment.js staging";

packageJson.scripts["staging:watch"] =
    "nodemon scripts/start-environment.js staging";

packageJson.scripts.start =
    "node scripts/start-environment.js production";

packageJson.scripts.production =
    "node scripts/start-environment.js production";

packageJson.scripts["env:check:development"] =
    "node scripts/check-environment.js development";

packageJson.scripts["env:check:staging"] =
    "node scripts/check-environment.js staging";

packageJson.scripts["env:check:production"] =
    "node scripts/check-environment.js production";

fs.writeFileSync(
    packagePath,
    JSON.stringify(
        packageJson,
        null,
        2
    ) + "\n",
    "utf8"
);

console.log(
    "package.json scripts updated successfully."
);

console.log(
    `Backup: ${backupPath}`
);
