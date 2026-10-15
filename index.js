const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN || "AapkaSecretToken123";
let AUTH_TOKEN = process.env.AUTH_TOKEN || "";

// Clean spaces/newlines
AUTH_TOKEN = AUTH_TOKEN.replace(/\s+/g, '').trim();

let lastPeriod = "";

app.get('/', (req, res) => {
  res.send('DmFirst WinGo Worker Active 24/7!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function fetchWinGo1MResult() {
  // Endpoints list to guarantee fetching
  const endpoints = [
    'https://www.dmfirst0.com/api/web/game/getHistory?gameCode=WinGo_30S&tenant=ar103',
    'https://api.dmfirst9api.com/api/web/game/getHistory?gameCode=WinGo_30S&tenant=ar103',
    'https://api.dmfirst9api.com/web/game/getHistory?gameCode=WinGo_30S&tenant=ar103',
    'https://www.dmfirst0.com/api/web/game/getHistory?gameCode=WinGo_1M&tenant=ar103'
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.dmfirst0.com/',
    'Origin': 'https://www.dmfirst0.com',
    'tenant': 'ar103'
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = AUTH_TOKEN.startsWith('Bearer') ? AUTH_TOKEN : `Bearer ${AUTH_TOKEN}`;
    headers['token'] = AUTH_TOKEN;
  }

  for (const url of endpoints) {
    try {
      const response = await axios.get(url, { headers, timeout: 5000 });

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
                platform: "WinGo 1 Min"
              }
            });
            console.log(`[SUCCESS] [WinGo 1 Min] Period: ${period} | Result: ${resultType}`);
          }
        }
        return; // Break loop on success
      }
    } catch (error) {
      // Continue trying next endpoint silently
    }
  }

  console.log(`[WARNING] All endpoints returned invalid response or token expired.`);
}

setInterval(fetchWinGo1MResult, 8000);
