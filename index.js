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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

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

    // Automatic Login Handling using env credentials
    try {
        console.log("[LOGIN] Filling credentials...");
        await page.waitForSelector('input', { timeout: 15000 });
        
        const inputs = await page.$$('input');
        if (inputs.length >= 2) {
            await inputs[0].type(DEMO_USER, { delay: 100 });
            await inputs[1].type(DEMO_PASS, { delay: 100 });
        }

        // Click login button
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const loginBtn = buttons.find(el => el.textContent.toLowerCase().includes('log') || el.textContent.includes('登录'));
            if (loginBtn) loginBtn.click();
        });

        console.log("[LOGIN] Credentials submitted, waiting for dashboard...");
        await page.waitForTimeout(6000);
    } catch (err) {
        console.log("[LOGIN NOTICE] Manual input skipped or already logged in:", err.message);
    }

    // Popup Confirm handling
    try {
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, div, span'));
            const confirmBtn = btns.find(el => el.textContent.trim() === 'Confirm' || el.textContent.trim() === '确定');
            if (confirmBtn) confirmBtn.click();
        });
    } catch(e) {}

    console.log("[NAVIGATE] Moving to Lottery -> WinGo 1 Min...");
    await page.goto('https://www.dmfirst0.com/#/lottery', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Click WinGo 1 Min game section
    await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('div, span, a'));
        const target = elements.find(el => el.textContent.includes('WinGo 1M') || el.textContent.includes('WinGo 1 Min'));
        if (target) target.click();
    });

    console.log("[SUCCESS] Worker active and monitoring WinGo 1 Min results!");

    // Keep session alive with small scrolls
    setInterval(async () => {
        try {
            await page.evaluate(() => window.scrollBy(0, 10));
            await page.evaluate(() => window.scrollBy(0, -10));
        } catch (err) {}
    }, 15000);
}

startBot().catch(console.error);
