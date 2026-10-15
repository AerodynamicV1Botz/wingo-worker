/*
=========================================================
 PROJECT : DmFirst WinGo 1M Worker
 PURPOSE : Login, monitor WinGo results and forward them
 PLATFORM: Render + Node.js + Puppeteer
=========================================================
*/

// =======================================================
// SCRIPT 01 — ENVIRONMENT & MODULES
// =======================================================

const fs = require("fs");
const path = require("path");

// Keep Chrome cache inside the project directory.
// Render build must install Chrome in this same directory.
const CACHE_DIR = path.join(
  __dirname,
  ".cache",
  "puppeteer"
);

process.env.PUPPETEER_CACHE_DIR = CACHE_DIR;

const puppeteer = require("puppeteer");
const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "1mb" }));

// =======================================================
// SCRIPT 02 — CONFIGURATION
// =======================================================

const PORT = process.env.PORT || 10000;

// API endpoint supplied by the user.
const BOTBUSINESS_API =
  "https://api.botbusiness.net/v1/bots/3001907/runs";

// Replace these placeholders with your actual credentials.
const SECRET_TOKEN = "wingo_secret_2026";
const DEMO_USER = "922878117";
const DEMO_PASS = "Demo1432";

const LOGIN_URL = "https://www.dmfirst0.com/#/login";

let browser = null;
let page = null;

let workerStarting = false;
let workerStarted = false;
let lastResultKey = "";

let keepAliveTimer = null;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// =======================================================
// SCRIPT 03 — HEALTH CHECK
// =======================================================

app.get("/", (req, res) => {
  res.status(200).send(
    "DmFirst WinGo 1M Worker Active 24/7!"
  );
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    worker: "DmFirst WinGo 1M",
    browserConnected: Boolean(
      browser && browser.isConnected()
    ),
    pageAvailable: Boolean(
      page && !page.isClosed()
    ),
    workerStarted,
    time: new Date().toISOString()
  });
});

// =======================================================
// SCRIPT 04 — CONFIGURATION VALIDATION
// =======================================================

function validateConfiguration() {
  const missing = [];

  if (
    !SECRET_TOKEN ||
    SECRET_TOKEN === "PASTE_YOUR_SECRET_TOKEN_HERE"
  ) {
    missing.push("SECRET_TOKEN");
  }

  if (
    !DEMO_USER ||
    DEMO_USER === "PASTE_YOUR_DEMO_USERNAME_HERE"
  ) {
    missing.push("DEMO_USER");
  }

  if (
    !DEMO_PASS ||
    DEMO_PASS === "PASTE_YOUR_DEMO_PASSWORD_HERE"
  ) {
    missing.push("DEMO_PASS");
  }

  if (missing.length > 0) {
    throw new Error(
      "Please configure these values inside index.js: " +
      missing.join(", ")
    );
  }
}

// =======================================================
// SCRIPT 05 — CHROME DIAGNOSTICS
// =======================================================

function checkChrome() {
  const executablePath = puppeteer.executablePath();

  console.log("======================================");
  console.log("[DEBUG] Node version:", process.version);
  console.log("[DEBUG] Cache directory:", CACHE_DIR);
  console.log("[DEBUG] Chrome executable:", executablePath);

  console.log(
    "[DEBUG] Cache directory exists:",
    fs.existsSync(CACHE_DIR)
  );

  console.log(
    "[DEBUG] Chrome executable exists:",
    fs.existsSync(executablePath)
  );

  console.log("======================================");

  if (!fs.existsSync(executablePath)) {
    throw new Error(
      "Chrome executable missing. Ensure Render installs " +
      "Puppeteer Chrome into the project-local cache."
    );
  }

  return executablePath;
}

// =======================================================
// SCRIPT 06 — BROWSER LAUNCH
// =======================================================

async function launchBrowser() {
  const executablePath = checkChrome();

  console.log("[BROWSER] Launching Chrome...");

  browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process", // Render ke low RAM (512MB) ke liye sabse important
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-features=Translate,BackForwardCache"
    ],
    timeout: 60000
  });

  browser.on("disconnected", () => {
    console.error("[BROWSER] Browser disconnected.");

    workerStarted = false;
    page = null;
  });

  page = await browser.newPage();

  await page.setViewport({
    width: 1365,
    height: 768
  });

  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(30000);

  console.log("[BROWSER] Chrome launched successfully.");

  return page;
}

// =======================================================
// SCRIPT 07 — OPEN LOGIN PAGE
// =======================================================

async function openLoginPage() {
  console.log("[LOGIN] Opening:", LOGIN_URL);

  await page.goto(LOGIN_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await sleep(5000);

  console.log("[LOGIN] Website loaded.");
}

// =======================================================
// SCRIPT 08 — LOGIN FORM
// =======================================================

async function loginToWebsite() {
  console.log("[LOGIN] Searching for login fields...");

  const inputDetails = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll("input")
    ).map((input) => ({
      type: (input.type || "").toLowerCase(),
      placeholder: input.placeholder || "",
      name: input.name || "",
      visible:
        input.offsetWidth > 0 &&
        input.offsetHeight > 0
    }));
  });

  console.log(
    "[LOGIN] Input fields:",
    JSON.stringify(inputDetails)
  );

  const usernameSelectors = [
    'input[placeholder*="Username" i]',
    'input[placeholder*="Account" i]',
    'input[placeholder*="Mobile" i]',
    'input[placeholder*="User" i]',
    'input[name="username"]',
    'input[name="account"]',
    'input[type="text"]',
    'input:not([type])'
  ];

  const passwordSelectors = [
    'input[type="password"]',
    'input[placeholder*="Password" i]',
    'input[name="password"]'
  ];

  async function findVisibleInput(selectors) {
    for (const selector of selectors) {
      const elements = await page.$$(selector);

      for (const element of elements) {
        const visible = await element
          .isIntersectingViewport()
          .catch(() => false);

        if (visible) {
          return element;
        }
      }
    }

    return null;
  }

  const usernameInput =
    await findVisibleInput(usernameSelectors);

  const passwordInput =
    await findVisibleInput(passwordSelectors);

  if (!usernameInput || !passwordInput) {
    throw new Error(
      "Login fields not found. Website selectors may have changed."
    );
  }

  await usernameInput.click();
  await usernameInput.type(String(DEMO_USER), {
    delay: 30
  });

  await passwordInput.click();
  await passwordInput.type(String(DEMO_PASS), {
    delay: 30
  });

  console.log("[LOGIN] Credentials entered.");

  const loginButtonClicked = await page.evaluate(() => {
    const elements = Array.from(
      document.querySelectorAll(
        'button, input[type="submit"], [role="button"]'
      )
    );

    const target = elements.find((element) => {
      const text = (
        element.innerText ||
        element.value ||
        element.textContent ||
        ""
      ).trim().toLowerCase();

      const visible =
        element.offsetWidth > 0 &&
        element.offsetHeight > 0;

      return (
        visible &&
        (
          text === "login" ||
          text === "log in" ||
          text === "sign in" ||
          text === "เข้าสู่ระบบ" ||
          text.includes("login")
        )
      );
    });

    if (!target) return false;

    target.click();
    return true;
  });

  if (!loginButtonClicked) {
    throw new Error(
      "Login button not found. Website selectors may have changed."
    );
  }

  console.log("[LOGIN] Login button clicked.");

  await sleep(7000);

  await dismissConfirmPopup();
}

// =======================================================
// SCRIPT 09 — DISMISS CONFIRM POPUP
// =======================================================

async function dismissConfirmPopup() {
  try {
    const clicked = await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll(
          "button, [role='button'], .van-button, .el-button"
        )
      );

      const target = elements.find((element) => {
        const text = (
          element.innerText ||
          element.textContent ||
          ""
        ).trim().toLowerCase();

        const visible =
          element.offsetWidth > 0 &&
          element.offsetHeight > 0;

        return (
          visible &&
          ["confirm", "ok", "close"].includes(text)
        );
      });

      if (!target) return false;

      target.click();
      return true;
    });

    if (clicked) {
      console.log("[POPUP] Confirm popup dismissed.");
      await sleep(2000);
    } else {
      console.log("[POPUP] No Confirm popup detected.");
    }
  } catch (error) {
    console.log("[POPUP] Check failed:", error.message);
  }
}

// =======================================================
// SCRIPT 10 — OPEN LOTTERY / WINGO 1M
// =======================================================

async function openWinGoPage() {
  console.log("[GAME] Opening Lottery page...");

  await page.goto(
    "https://www.dmfirst0.com/#/lottery",
    {
      waitUntil: "domcontentloaded",
      timeout: 60000
    }
  );

  await sleep(5000);

  const clicked = await page.evaluate(() => {
    const elements = Array.from(
      document.querySelectorAll(
        "button, a, div, span, li"
      )
    );

    const target = elements.find((element) => {
      const text = (
        element.innerText ||
        element.textContent ||
        ""
      ).trim().toLowerCase();

      const visible =
        element.offsetWidth > 0 &&
        element.offsetHeight > 0;

      return (
        visible &&
        [
          "wingo 1m",
          "wingo 1 min",
          "win go 1m"
        ].includes(text)
      );
    });

    if (!target) return false;

    target.click();
    return true;
  });

  if (clicked) {
    console.log("[GAME] WinGo 1M selected.");
  } else {
    console.log(
      "[GAME] WinGo 1M not detected. Website layout may have changed."
    );
  }

  await sleep(5000);
}

// =======================================================
// SCRIPT 11 — EXTRACT RESULT
// =======================================================

function extractResult(responseData) {
  if (
    !responseData ||
    typeof responseData !== "object"
  ) {
    return null;
  }

  let list = null;

  if (
    responseData.data &&
    Array.isArray(responseData.data.list)
  ) {
    list = responseData.data.list;
  } else if (Array.isArray(responseData.list)) {
    list = responseData.list;
  } else if (
    responseData.data &&
    Array.isArray(responseData.data)
  ) {
    list = responseData.data;
  }

  if (!list || list.length === 0) {
    return null;
  }

  const item = list[0];

  if (!item || typeof item !== "object") {
    return null;
  }

  const period =
    item.issueNumber ??
    item.issue ??
    item.period ??
    item.periodNumber ??
    item.drawNumber;

  const rawNumber =
    item.number ??
    item.result ??
    item.openNumber ??
    item.winNumber;

  if (
    period === undefined ||
    period === null ||
    rawNumber === undefined ||
    rawNumber === null
  ) {
    return null;
  }

  let number;

  if (typeof rawNumber === "number") {
    number = rawNumber;
  } else {
    const cleaned = String(rawNumber).trim();

    if (!/^\d+$/.test(cleaned)) {
      return null;
    }

    number = Number(cleaned);
  }

  if (
    !Number.isFinite(number) ||
    number < 0 ||
    number > 9
  ) {
    return null;
  }

  return {
    period: String(period),
    number,
    result: number >= 5 ? "BIG" : "SMALL"
  };
}

// =======================================================
// SCRIPT 12 — FORWARD RESULT TO BOT BUSINESS
// =======================================================

async function sendResultToBotBusiness(resultData) {
  try {
    const payload = {
      command: "/api_result_receiver",
      options: {
        token: SECRET_TOKEN,
        period: resultData.period,
        number: resultData.number,
        result: resultData.result,
        platform: "DMFirst WinGo 1M"
      }
    };

    console.log(
      "[API] Sending period:",
      resultData.period
    );

    const response = await axios.post(
      BOTBUSINESS_API,
      payload,
      {
        timeout: 20000,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    console.log(
      "[API] Response status:",
      response.status
    );

    console.log(
      "[API] Result forwarded:",
      resultData.period,
      resultData.number,
      resultData.result
    );

    return true;
  } catch (error) {
    console.error(
      "[API] Forwarding failed:",
      error.response
        ? JSON.stringify(error.response.data)
        : error.message
    );

    return false;
  }
}

// =======================================================
// SCRIPT 13 — NETWORK RESPONSE MONITOR
// =======================================================

function setupResponseMonitor() {
  console.log("[MONITOR] Activating response listener...");

  page.on("response", async (response) => {
    try {
      const url = response.url();

      if (
        !url.includes("getHistory") &&
        !url.includes("WinGo")
      ) {
        return;
      }

      if (!response.ok()) return;

      const contentType =
        response.headers()["content-type"] || "";

      if (
        !contentType.includes("json") &&
        !url.includes("getHistory")
      ) {
        return;
      }

      let responseData;

      try {
        responseData = await response.json();
      } catch (error) {
        return;
      }

      const extracted = extractResult(responseData);

      if (!extracted) return;

      const resultKey =
        extracted.period + ":" + extracted.number;

      if (resultKey === lastResultKey) return;

      lastResultKey = resultKey;

      console.log(
        "[RESULT]",
        JSON.stringify(extracted)
      );

      await sendResultToBotBusiness(extracted);
    } catch (error) {
      console.error(
        "[MONITOR] Processing error:",
        error.message
      );
    }
  });

  console.log("[MONITOR] Listener active.");
}

// =======================================================
// SCRIPT 14 — KEEPALIVE
// =======================================================

function startKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
  }

  console.log("[KEEPALIVE] Starting 15-second loop.");

  keepAliveTimer = setInterval(async () => {
    try {
      if (
        !browser ||
        !browser.isConnected() ||
        !page ||
        page.isClosed()
      ) {
        return;
      }

      await page.evaluate(() => {
        window.scrollBy(0, 1);
        window.scrollBy(0, -1);
      });
    } catch (error) {
      console.error(
        "[KEEPALIVE] Error:",
        error.message
      );
    }
  }, 15000);
}

// =======================================================
// SCRIPT 15 — START WORKER
// =======================================================

async function startWorker() {
  if (workerStarting || workerStarted) {
    console.log("[WORKER] Already starting or running.");
    return;
  }

  workerStarting = true;

  try {
    validateConfiguration();

    console.log("[WORKER] Starting...");

    await launchBrowser();

    setupResponseMonitor();

    await openLoginPage();

    await loginToWebsite();

    await openWinGoPage();

    workerStarted = true;

    console.log("[WORKER] Startup sequence completed.");

    startKeepAlive();
  } catch (error) {
    workerStarted = false;

    console.error(
      "[WORKER] Startup failed:",
      error.stack || error.message
    );

    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error(
          "[BROWSER] Close error:",
          closeError.message
        );
      }
    }

    browser = null;
    page = null;
  } finally {
    workerStarting = false;
  }
}

// =======================================================
// SCRIPT 16 — EXPRESS SERVER
// =======================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("[SERVER] Listening on port:", PORT);

  console.log("[SERVER] Health endpoint: /health");

  startWorker().catch((error) => {
    console.error(
      "[WORKER] Unexpected error:",
      error.stack || error.message
    );
  });
});

// =======================================================
// SCRIPT 17 — PROCESS ERROR HANDLERS
// =======================================================

process.on("unhandledRejection", (reason) => {
  console.error("[PROCESS] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error(
    "[PROCESS] Uncaught exception:",
    error.stack || error.message
  );
});
