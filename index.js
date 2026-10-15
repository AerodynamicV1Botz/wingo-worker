/*
=========================================================
 PROJECT : DmFirst WinGo 1M Worker (Final Production)
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

// Correct Bots.business Command Execution Endpoint
const BOTBUSINESS_API = process.env.BOTBUSINESS_API || "https://api.bots.business/v1/bots/3001907/commands/run";
const SECRET_TOKEN = process.env.SECRET_TOKEN || "wingo_secret_2026";
const DEMO_USER = process.env.DEMO_USER || "922878117";
const DEMO_PASS = process.env.DEMO_PASS || "Demo1432";
const ADMIN_ID = "7897324623";
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

async function notifyAdminConnection() {
  try {
    const payload = {
      command: "/api_admin_notifier",
      options: {
        token: SECRET_TOKEN,
        admin_id: ADMIN_ID,
        message: "🟢 **RENDER WORKER CONNECTED!**\n\nDmFirst WinGo 1M scraper is active and linked with BotBusiness!"
      }
    };
    const res = await axios.post(BOTBUSINESS_API, payload, { timeout: 10000 });
    console.log("[ADMIN NOTIFIED]: Alert sent to BotBusiness API. Status:", res.status);
  } catch (err) {
    console.error("[NOTIFY ERROR]:", err.response ? err.response.data : err.message);
  }
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

  console.log("[NAVIGATION] Navigation complete! Active on WinGo Game Page.");
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
    console.error("[FORWARD ERROR]:", error.response ? error.response.data : error.message);
    return false;
  }
}

// Live WebSocket & DOM Table Scraper Bridge
function setupResponseMonitor() {
  console.log("[MONITOR] Starting Live WebSocket & DOM Bridge...");

  page.target().createCDPSession().then(async (client) => {
    await client.send('Network.enable');
    client.on('Network.webSocketFrameReceived', async ({ response }) => {
      try {
        const payloadData = response.payloadData;
        if (payloadData && (payloadData.includes("issue") || payloadData.includes("period") || payloadData.includes("number"))) {
          let parsed;
          try { parsed = JSON.parse(payloadData); } catch (e) {}

          if (parsed) {
            let period = parsed.issueNumber || parsed.issue || parsed.period || parsed.periodNumber;
            let num = parsed.number ?? parsed.result ?? parsed.openNumber;

            if (period && num !== undefined) {
              const number = parseInt(num);
              const key = String(period) + ":" + number;
              if (key !== lastResultKey) {
                lastResultKey = key;
                const resultType = number >= 5 ? "BIG" : "SMALL";
                console.log("[WEBSOCKET SUCCESS]:", period, number, resultType);
                await sendResultToBotBusiness({ period: String(period), number, result: resultType });
              }
            }
          }
        }
      } catch (err) {}
    });
  }).catch(e => {});

  setInterval(async () => {
    try {
      if (!page || page.isClosed()) return;

      const rowData = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr, .van-row, div'));
        for (let r of rows) {
          const txt = (r.innerText || "").trim();
          const match = txt.match(/202[5-9]\d{12,16}/);
          if (match) {
            const period = match[0];
            const digits = txt.match(/\b[0-9]\b/g);
            if (digits && digits.length > 0) {
              const number = parseInt(digits[0]);
              if (!isNaN(number) && number >= 0 && number <= 9) {
                return { period, number };
              }
            }
          }
        }
        return null;
      });

      if (rowData && rowData.period && rowData.number !== undefined) {
        const key = rowData.period + ":" + rowData.number;
        if (key !== lastResultKey) {
          lastResultKey = key;
          const resultType = rowData.number >= 5 ? "BIG" : "SMALL";
          console.log("[DOM TABLE SUCCESS]:", rowData.period, rowData.number, resultType);
          await sendResultToBotBusiness({ period: String(rowData.period), number: rowData.number, result: resultType });
        }
      }
    } catch (err) {}
  }, 3000);
}

function startKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(async () => {
    try {
      if (page && !page.isClosed()) {
        await page.evaluate(() => window.scrollBy(0, 1));
      }
    } catch (e) {}
  }, 15000);
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

    await notifyAdminConnection();
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
