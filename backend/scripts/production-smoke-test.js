"use strict";

const rawBase =
    process.argv[2] ||
    process.env.RUKHNAV_BASE_URL ||
    process.env.APP_URL ||
    "";

const baseUrl =
    String(rawBase)
        .trim()
        .replace(/\/+$/, "");

if (!baseUrl) {
    console.error(
        "Usage: node scripts/production-smoke-test.js https://your-domain.com"
    );
    process.exit(1);
}

const tests = [
    {
        name: "API health",
        path: "/api/health",
        type: "json"
    },
    {
        name: "Storefront",
        path: "/store/index.html",
        type: "html"
    },
    {
        name: "Admin login",
        path: "/admin/login.html",
        type: "html"
    },
    {
        name: "Public products API",
        path: "/api/products?limit=1",
        type: "json"
    }
];

async function run() {
    console.log("========================================");
    console.log("RUKHNAV POST-DEPLOY SMOKE TEST");
    console.log(`Target: ${baseUrl}`);
    console.log("========================================");

    let failures = 0;

    for (const test of tests) {
        const url = `${baseUrl}${test.path}`;

        try {
            const response = await fetch(
                url,
                {
                    redirect: "follow",
                    headers: {
                        "user-agent":
                            "RUKHNAV-Production-Smoke-Test/1.0"
                    }
                }
            );

            const ok =
                response.status >= 200 &&
                response.status < 400;

            if (!ok) {
                failures++;
                console.error(
                    `FAIL  ${test.name}: HTTP ${response.status}`
                );
                continue;
            }

            if (test.type === "json") {
                const contentType =
                    response.headers.get(
                        "content-type"
                    ) || "";

                if (
                    !contentType
                        .toLowerCase()
                        .includes("application/json")
                ) {
                    failures++;
                    console.error(
                        `FAIL  ${test.name}: expected JSON`
                    );
                    continue;
                }
            }

            console.log(
                `PASS  ${test.name}: HTTP ${response.status}`
            );
        } catch (error) {
            failures++;
            console.error(
                `FAIL  ${test.name}: ${error.message}`
            );
        }
    }

    console.log("========================================");

    if (failures) {
        console.error(
            `Smoke test failed: ${failures} check(s).`
        );
        process.exit(1);
    }

    console.log("Smoke test passed.");
}

run();
