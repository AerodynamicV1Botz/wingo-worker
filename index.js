/*
=========================================================
 PROJECT : DmFirst WinGo 1M Worker
 PURPOSE : Final Complete Code with Network API Interceptor
 PLATFORM: Render + Node.js + Puppeteer
=========================================================
*/

const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(__dirname, ".cache", "puppeteer");
process.env.PUPPETEER_CACHE_DIR = CACHE_DIR;

const puppeteer = require("puppeteer");
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 10000;
const BOTBUSINESS_API = "https://api.botbusiness.net/v1/bots/3001907/runs";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.get("/", (req, res) => {
  res.status(200).send("DmFirst WinGo 1M Worker Active 24/7!");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    worker: "DmFirst WinGo 1M",
    browserConnected: Boolean(browser && browser.isConnected()),
    pageAvailable: Boolean(page && !page.isClosed()),
    workerStarted,
    time: new Date().toISOString()
  });
});

function validateConfiguration() {
  if (!SECRET_TOKEN || !DEMO_USER || !DEMO_PASS) {
    throw new Error("Missing configuration settings.");
  }
}

function checkChrome() {
  const executablePath = puppeteer.executablePath();
  if (!fs.existsSync(executablePath)) {
    throw new Error("Chrome executable missing.");
  }
  return executablePath;
}

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
      "--single-process",
      "--disable-software-rasterizer"
    ],
    timeout: 60000
  });

  page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(30000);

  console.log("[BROWSER] Chrome launched in Mobile View.");
  return page;
}

async function clearAllPopups() {
  console.log("[POPUP] Checking for warning/announcement popups...");
  for (let i = 0; i < 4; i++) {
    try {
      const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button, .van-button, div, span"));
        const target = btns.find((b) => {
          const txt = (b.innerText || b.textContent || "").trim().toLowerCase();
          return txt === "confirm" || txt === "close" || txt === "ok";
        });
        if (target && target.offsetWidth > 0) {
          target.click();
          return true;
        }
        return false;
      });
      if (clicked) {
        console.log(`[POPUP] Dismissed popup ${i + 1}`);
        await sleep(1500);
      }
    } catch (e) {}
  }
}

async function navigateToWinGo1M() {
  console.log("[NAVIGATION] Starting step-by-step navigation...");

  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(4000);

  console.log("[LOGIN] Entering phone & password...");
  const inputs = await page.$$("input");
  if (inputs.length >= 2) {
    await inputs[0].type(String(DEMO_USER), { delay: 30 });
    await inputs[1].type(String(DEMO_PASS), { delay: 30 });
  }

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
    const target = btns.find((b) => (b.innerText || "").toLowerCase().includes("login"));
    if (target) target.click();
  });

  console.log("[LOGIN] Login button clicked, waiting for home page...");
  await sleep(6000);

  await clearAllPopups();

  console.log("[NAVIGATION] Clicking 'Lottery' category...");
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("div, span, p, a"));
    const lotteryBtn = items.find((el) => (el.innerText || "").trim().toLowerCase() === "lottery");
    if (lotteryBtn) lotteryBtn.click();
  });
  await sleep(2500);

  console.log("[NAVIGATION] Selecting 'WINGO' game card...");
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("div, span, p, img"));
    const wingoCard = cards.find((el) => (el.innerText || "").trim().toUpperCase().includes("WINGO"));
    if (wingoCard) wingoCard.click();
  });
  await sleep(4000);

  await clearAllPopups();

  console.log("[NAVIGATION] Switching to 'WinGo 1 Min' tab...");
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll("div, span, p, button"));
    const targetTab = tabs.find((el) => {
      const txt = (el.innerText || "").trim();
      return txt === "WinGo 1 Min" || txt === "1 Min" || txt.includes("1 Min");
    });
    if (targetTab) targetTab.click();
  });
  await sleep(3000);

  console.log("[NAVIGATION] Scrolling down to Game History Table...");
  await page.evaluate(() => {
    window.scrollBy(0, 500);
  });
  await sleep(2000);

  console.log("[NAVIGATION] Navigation complete! Active on Game History Table.");
}

async function sendResultToBotBusiness(resultData) {
  try {
    const payload = {
      command: "/api_result_receiver",
      options: {
        token: SECRET_TOKEN,
        period: String(resultData.period).trim(),
        number: resultData.number,
        result: String(resultData.result).trim(),
        platform: "DMFIRST GAME"
      }
    };

    console.log("==================================================");
    console.log("[LIVE FORWARD] Period:", resultData.period, "| Number:", resultData.number, "| Result:", resultData.result);
    
    const response = await axios.post(BOTBUSINESS_API, payload, {
      timeout: 15000,
      headers: { "Content-Type": "application/json" }
    });

    console.log("[BOTBUSINESS RESPONSE]: Status", response.status, JSON.stringify(response.data));
    console.log("==================================================");
    return true;
  } catch (error) {
    console.error("[FORWARD ERROR]:", error.message);
    return false;
  }
}

// Enhanced Network API Interceptor with Periodic Trigger
function setupResponseMonitor() {
  console.log("[MONITOR] Starting Active Network API Interceptor...");

  page.on("response", async (response) => {
    try {
      const url = response.url();
      if (!response.ok()) return;

      if (url.includes("history") || url.includes("list") || url.includes("GetNoList") || url.includes("open") || url.includes("game")) {
        let json;
        try {
          json = await response.json();
        } catch (e) {
          return;
        }

        let list = null;
        if (json && json.data) {
          list = json.data.list || json.data.data || json.data;
        } else if (json && json.list) {
          list = json.list;
        }

        if (Array.isArray(list) && list.length > 0) {
          const item = list[0];
          const period = item.issueNumber || item.issue || item.period || item.periodNumber || item.gameNo;
          const num = item.number ?? item.result ?? item.openNumber ?? item.winNumber;

          if (period && num !== undefined) {
            const number = parseInt(num);
            const key = String(period) + ":" + number;

            if (key !== lastResultKey) {
              lastResultKey = key;
              const resultType = number >= 5 ? "BIG" : "SMALL";
              console.log("[API CAPTURED SUCCESS]: Period:", period, "| Number:", number, "| Result:", resultType);

              await sendResultToBotBusiness({
                period: String(period),
                number: number,
                result: resultType
              });
            }
          }
        }
      }
    } catch (err) {}
  });
}

function startKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(async () => {
    try {
      if (page && !page.isClosed()) {
        // Har 10 second mein thoda scroll karke history table ko active karenge taaki API call ho
        await page.evaluate(() => {
          window.scrollBy(0, 10);
          setTimeout(() => window.scrollBy(0, -10), 500);
        });
      }
    } catch (e) {}
  }, 10000);
}

async function startWorker() {
  if (workerStarting || workerStarted) return;
  workerStarting = true;

  try {
    validateConfiguration();
    console.log("[WORKER] Launching worker sequence...");
    await launchBrowser();
    await navigateToWinGo1M();
    setupResponseMonitor();

    workerStarted = true;
    console.log("[WORKER] 24/7 Monitoring Active!");
    startKeepAlive();
  } catch (error) {
    workerStarted = false;
    console.error("[WORKER CRASHED]:", error.message);
    if (browser) { try { await browser.close(); } catch (e) {} }
    browser = null;
    page = null;
  } finally {
    workerStarting = false;
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log("[SERVER] Active on port:", PORT);
  startWorker().catch((err) => console.error("[STARTUP ERROR]:", err.message));
});
