const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const cacheDir =
    process.env.PUPPETEER_CACHE_DIR ||
    path.join(require("os").homedir(), ".cache", "puppeteer");

console.log("[DEBUG] Cache directory:", cacheDir);

function inspectDirectory(dir, depth = 0) {
    if (depth > 5) return;

    try {
        if (!fs.existsSync(dir)) {
            console.log("[MISSING]", dir);
            return;
        }

        const entries = fs.readdirSync(dir, {
            withFileTypes: true
        });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                console.log("[DIR]", fullPath);
                inspectDirectory(fullPath, depth + 1);
            } else if (
                entry.name === "chrome" ||
                entry.name.startsWith("chrome")
            ) {
                console.log("[FILE]", fullPath);
            }
        }
    } catch (error) {
        console.log("[INSPECT ERROR]", error.message);
    }
}

console.log("[DEBUG] Expected executable:", puppeteer.executablePath());

inspectDirectory(cacheDir);

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.status(200).send("DmFirst WinGo 1M Worker Active 24/7!");
});

app.listen(PORT, () => {
    console.log(`[SERVER] Running on port ${PORT}`);
});

const BOTBUSINESS_API = process.env.BOTBUSINESS_API;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const DEMO_USER = process.env.DEMO_USER;
const DEMO_PASS = process.env.DEMO_PASS;

let lastPeriod = "";
let browserInstance = null;

function getChromePath() {
    // First check Puppeteer's expected bundled Chrome path.
    try {
        const bundledPath = puppeteer.executablePath();

        console.log("[DEBUG] Expected Chrome path:", bundledPath);
        console.log(
            "[DEBUG] Bundled Chrome exists:",
            fs.existsSync(bundledPath)
        );

        if (fs.existsSync(bundledPath)) {
            return bundledPath;
        }
    } catch (error) {
        console.log("[DEBUG] Bundled Chrome lookup failed:", error.message);
    }

    // Optional explicit path for a Chrome installation on the host.
    const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH;

    if (configuredPath && fs.existsSync(configuredPath)) {
        console.log("[DEBUG] Using configured Chrome:", configuredPath);
        return configuredPath;
    }

    // Search common Linux executable locations.
    const candidates = [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser"
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            console.log("[DEBUG] Using system Chrome:", candidate);
            return candidate;
        }
    }

    throw new Error(
        "Chrome executable not found. Ensure Puppeteer's Chrome is installed " +
        "during the Render build, or set PUPPETEER_EXECUTABLE_PATH."
    );
}

async function startBot() {
    console.log("[STATUS] Starting WinGo worker...");

    if (!DEMO_USER || !DEMO_PASS) {
        console.warn(
            "[CONFIG WARNING] DEMO_USER or DEMO_PASS is missing."
        );
    }

    if (!BOTBUSINESS_API) {
        console.warn(
            "[CONFIG WARNING] BOTBUSINESS_API is missing; results will not be forwarded."
        );
    }

    const chromePath = getChromePath();

    console.log("[STATUS] Launching Chrome:", chromePath);

    browserInstance = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu"
        ]
    });

    const page = await browserInstance.newPage();

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/120.0.0.0 Safari/537.36"
    );

    // Monitor responses for WinGo history/results.
    page.on("response", async (response) => {
        const url = response.url();

        if (!url.includes("getHistory") && !url.includes("WinGo")) {
            return;
        }

        try {
            const data = await response.json();

            if (!data || !data.data || !Array.isArray(data.data.list)) {
                return;
            }

            const latest = data.data.list[0];

            if (!latest) {
                return;
            }

            const period = latest.period || latest.issueNumber;
            const numberResult = Number.parseInt(
                latest.number ?? latest.resultNum,
                10
            );

            if (
                period == null ||
                period === "" ||
                !Number.isFinite(numberResult) ||
                String(period) === lastPeriod
            ) {
                return;
            }

            lastPeriod = String(period);

            const resultType = numberResult >= 5 ? "BIG" : "SMALL";

            console.log(
                `[LIVE RESULT] Period: ${period} | Number: ${numberResult} (${resultType})`
            );

            if (!BOTBUSINESS_API) {
                return;
            }

            try {
                const apiResponse = await axios.post(
                    BOTBUSINESS_API,
                    {
                        command: "/api_result_receiver",
                        options: {
                            token: SECRET_TOKEN,
                            period: String(period),
                            number: String(numberResult),
                            result: resultType,
                            platform: "WinGo 1 Min"
                        }
                    },
                    {
                        timeout: 15000
                    }
                );

                console.log(
                    "[API] Result forwarded. HTTP status:",
                    apiResponse.status
                );
            } catch (apiError) {
                console.error(
                    "[API ERROR]",
                    apiError.response?.status || "",
                    apiError.message
                );
            }
        } catch (error) {
            // Some responses are not JSON; ignore those responses.
        }
    });

    console.log("[LOGIN] Opening login page...");

    await page.goto("https://www.dmfirst0.com/#/login", {
        waitUntil: "networkidle2",
        timeout: 60000
    });

    // Automatic login using environment variables.
    try {
        console.log("[LOGIN] Checking login form...");

        await page.waitForSelector("input", {
            timeout: 15000
        });

        const inputs = await page.$$("input");

        if (inputs.length >= 2 && DEMO_USER && DEMO_PASS) {
            await inputs[0].type(DEMO_USER, { delay: 100 });
            await inputs[1].type(DEMO_PASS, { delay: 100 });

            await page.evaluate(() => {
                const buttons = Array.from(
                    document.querySelectorAll("button")
                );

                const loginButton = buttons.find((element) => {
                    const text = (element.textContent || "").toLowerCase();

                    return (
                        text.includes("log") ||
                        text.includes("登录")
                    );
                });

                if (loginButton) {
                    loginButton.click();
                }
            });

            console.log("[LOGIN] Credentials submitted.");
            await new Promise((resolve) => setTimeout(resolve, 6000));
        } else {
            console.warn(
                "[LOGIN NOTICE] Login fields or credentials are unavailable."
            );
        }
    } catch (error) {
        console.log("[LOGIN NOTICE]", error.message);
    }

    // Attempt to dismiss a confirmation popup.
    try {
        await page.evaluate(() => {
            const elements = Array.from(
                document.querySelectorAll("button, div, span")
            );

            const confirmButton = elements.find((element) => {
                const text = (element.textContent || "").trim();

                return text === "Confirm" || text === "确定";
            });

            if (confirmButton) {
                confirmButton.click();
            }
        });
    } catch (error) {
        console.log("[POPUP NOTICE]", error.message);
    }

    console.log("[NAVIGATE] Opening lottery page...");

    await page.goto("https://www.dmfirst0.com/#/lottery", {
        waitUntil: "networkidle2",
        timeout: 30000
    }).catch((error) => {
        console.log("[NAVIGATION NOTICE]", error.message);
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Attempt to select WinGo 1 Min.
    await page.evaluate(() => {
        const elements = Array.from(
            document.querySelectorAll("div, span, a")
        );

        const target = elements.find((element) => {
            const text = (element.textContent || "").trim();

            return text === "WinGo 1M" || text === "WinGo 1 Min";
        });

        if (target) {
            target.click();
        }
    });

    console.log(
        "[SUCCESS] Worker is running. Result monitoring is enabled."
    );

    // Keep the browser session active.
    setInterval(async () => {
        try {
            if (page.isClosed()) {
                return;
            }

            await page.evaluate(() => {
                window.scrollBy(0, 10);
                window.scrollBy(0, -10);
            });
        } catch (error) {
            console.log("[KEEPALIVE NOTICE]", error.message);
        }
    }, 15000);
}

startBot().catch((error) => {
    console.error("[FATAL] Worker startup failed:", error);

    if (browserInstance) {
        browserInstance.close().catch(() => {});
    }

    process.exitCode = 1;
});
