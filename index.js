const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN || "AapkaSecretToken123";
let AUTH_TOKEN = process.env.AUTH_TOKEN || "";

AUTH_TOKEN = AUTH_TOKEN.replace(/\s+/g, '').trim();
let lastPeriod = "";

app.get('/', (req, res) => {
  res.send('DmFirst WinGo Worker Active!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function fetchWinGoResult() {
  try {
    // Exact parameters matching your URL: WinGo_30S and lottery=WinGo
    const API_URL = `https://api.dmfirst9api.com/web/game/getHistory?gameCode=WinGo_30S&lottery=WinGo`;

    const response = await axios.get(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Authorization': AUTH_TOKEN,
        'token': AUTH_TOKEN,
        'tenant': 'ar103',
        'Referer': 'https://www.dmfirst0.com/',
        'Origin': 'https://www.dmfirst0.com'
      },
      timeout: 8000
    });

    if (response.data && response.data.data && response.data.data.list) {
      const latestGame = response.data.data.list[0];
      const period = latestGame.period || latestGame.issueNumber;
      const numberResult = parseInt(latestGame.number || latestGame.result);

      if (period && period !== lastPeriod) {
        lastPeriod = period;
        const resultType = (numberResult >= 5) ? "WIN" : "LOSS";

        if (BOT_TOKEN) {
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/runCommand`, {
            command: "/api_result_receiver",
            options: {
              token: SECRET_TOKEN,
              period: String(period),
              result: resultType,
              platform: "WinGo 30S"
            }
          });
          console.log(`[SUCCESS] [WinGo 30S] Period: ${period} | Result: ${resultType}`);
        }
      }
    } else {
      console.log(`[API RESPONSE]`, JSON.stringify(response.data));
    }
  } catch (error) {
    console.error(`[ERROR] Fetch Failed:`, error.message);
  }
}

setInterval(fetchWinGoResult, 8000);
