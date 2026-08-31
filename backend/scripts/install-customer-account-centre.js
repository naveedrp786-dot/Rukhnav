"use strict";

const fs =
    require("fs");

const path =
    require("path");

const serverPath =
    path.join(
        __dirname,
        "..",
        "server.js"
    );

if (!fs.existsSync(serverPath)) {
    throw new Error(
        "backend/server.js was not found."
    );
}

const backup =
    `${serverPath}.before-account-centre-modules`;

if (!fs.existsSync(backup)) {
    fs.copyFileSync(
        serverPath,
        backup
    );
}

let source =
    fs.readFileSync(
        serverPath,
        "utf8"
    );

if (
    !source.includes(
        'require("./routes/customerAddressRoutes")'
    )
) {
    const marker =
        'const express = require("express");';

    source =
        source.replace(
            marker,
            `${marker}
const customerAddressRoutes = require("./routes/customerAddressRoutes");
const customerPortalRoutes = require("./routes/customerPortalRoutes");`
        );
}

if (
    !source.includes(
        'app.use("/api/customer-addresses"'
    )
) {
    const mounts = `
app.use(
    "/api/customer-addresses",
    customerAddressRoutes
);

app.use(
    "/api/customer-portal",
    customerPortalRoutes
);

`;

    const marker =
        "// Home Route";

    const index =
        source.indexOf(marker);

    source =
        index >= 0
            ? source.slice(0, index) +
              mounts +
              source.slice(index)
            : source + mounts;
}

fs.writeFileSync(
    serverPath,
    source
);

console.log(
    "Customer Account Centre routes installed."
);
