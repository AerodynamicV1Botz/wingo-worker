const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN || "AapkaSecretToken123";
let AUTH_TOKEN = process.env.AUTH_TOKEN || "";

// Space & newlines clean up
AUTH_TOKEN = AUTH_TOKEN.replace(/\s+/g, '').trim();

let lastPeriod = "";

app.get('/', (req, res) => {
  res.send('DmFirst WinGo 1 Min Worker Active!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function fetchWinGo1MResult() {
  try {
    // Endpoints for DmFirst SaaS Lottery history
    const API_URL = `https://api.dmfirst9api.com/api/web/game/getHistory?gameCode=WinGo_1M&pageSize=10&pageNo=1`;

    const cleanToken = AUTH_TOKEN.replace(/^Bearer\s+/i, '');

    const response = await axios.get(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Authorization': cleanToken,
        'token': cleanToken,
        'tenant': 'ar103',
        'Referer': 'https://www.dmfirst0.com/',
        'Origin': 'https://www.dmfirst0.com'
      },
      timeout: 6000
    });

    if (response.data && response.data.data && response.data.data.list) {
      const latestGame = response.data.data.list[0];
      const period = latestGame.period || latestGame.issueNumber;
      const numberResult = parseInt(latestGame.number || latestGame.result);

      if (period && period !== lastPeriod) {
        lastPeriod = period;

        // Result Logic: 5-9 = WIN, 0-4 = LOSS
        const resultType = (numberResult >= 5) ? "WIN" : "LOSS";

        if (BOT_TOKEN) {
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/runCommand`, {
            command: "/api_result_receiver",
            options: {
              token: SECRET_TOKEN,
              period: String(period),
              result: resultType,
              platform: "WinGo 1 Min"
            }
          });
          console.log(`[SUCCESS] [WinGo 1 Min] Period: ${period} | Result: ${resultType}`);
        }
      }
    } else {
      console.log(`[API RESPONSE]`, JSON.stringify(response.data));
    }
  } catch (error) {
    console.error(`[ERROR] Fetch Failed:`, error.message);
  }
}

// Check every 8 seconds
setInterval(fetchWinGo1MResult, 8000);
