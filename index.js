const puppeteer = require('puppeteer');
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('DmFirst WinGo 1M Worker Active 24/7!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const BOTBUSINESS_API = process.env.BOTBUSINESS_API;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const DEMO_USER = process.env.DEMO_USER;
const DEMO_PASS = process.env.DEMO_PASS;

let lastPeriod = "";

async function startBot() {
    console.log("[STATUS] Launching Puppeteer Browser on Render...");
    
    const browser = await puppeteer.launch({
        executablePath: puppeteer.executablePath(),
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');

    // Network Interceptor for WinGo Live Results
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('getHistory') || url.includes('WinGo')) {
            try {
                const data = await response.json();
                if (data && data.data && data.data.list) {
                    const latest = data.data.list[0];
                    const period = latest.period || latest.issueNumber;
                    const numberResult = parseInt(latest.number || latest.resultNum);

                    if (period && period !== lastPeriod) {
                        lastPeriod = period;
                        const resultType = (numberResult >= 5) ? "BIG" : "SMALL";
                        console.log(`[LIVE RESULT] Period: ${period} | Number: ${numberResult} (${resultType})`);

                        if (BOTBUSINESS_API) {
                            await axios.post(BOTBUSINESS_API, {
                                command: "/api_result_receiver",
                                options: {
                                    token: SECRET_TOKEN,
                                    period: String(period),
                                    number: String(numberResult),
                                    result: resultType,
                                    platform: "WinGo 1 Min"
                                }
                            });
                        }
                    }
                }
            } catch (e) {}
        }
    });

    console.log("[LOGIN] Navigating to Login Page...");
    await page.goto('https://www.dmfirst0.com/#/login', { waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForSelector('input[type="text"], input[type="number"]', { timeout: 15000 });
    await page.type('input[type="text"], input[type="number"]', DEMO_USER, { delay: 100 });
    await page.type('input[type="password"]', DEMO_PASS, { delay: 100 });

    console.log("[LOGIN] Submitting credentials...");
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const loginBtn = buttons.find(el => el.textContent.includes('Log in'));
        if (loginBtn) loginBtn.click();
    });

    await page.waitForTimeout(5000);

    try {
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, div'));
            const confirmBtn = btns.find(el => el.textContent.trim() === 'Confirm');
            if (confirmBtn) confirmBtn.click();
        });
    } catch(e) {}

    console.log("[NAVIGATE] Moving to Lottery -> WinGo 1 Min...");
    await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('div, span, p'));
        const lotteryTab = items.find(el => el.textContent.trim() === 'Lottery');
        if (lotteryTab) lotteryTab.click();
    });

    await page.waitForTimeout(3000);

    await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('div, span'));
        const wingoCard = items.find(el => el.textContent.trim() === 'WINGO');
        if (wingoCard) wingoCard.click();
    });

    await page.waitForTimeout(3000);

    await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('div, span'));
        const min1Tab = items.find(el => el.textContent.trim() === 'WinGo 1 Min');
        if (min1Tab) min1Tab.click();
    });

    console.log("[SUCCESS] Worker active on WinGo 1 Min page!");

    setInterval(async () => {
        try {
            await page.evaluate(() => window.scrollBy(0, 20));
            await page.evaluate(() => window.scrollBy(0, -20));
        } catch (err) {}
    }, 15000);
}

startBot().catch(console.error);
