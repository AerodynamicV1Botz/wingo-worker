const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN || "AapkaSecretToken123";
const AUTH_TOKEN = process.env.AUTH_TOKEN; // Clean Token from Render Environment

// Games Configuration (WinGo 1 Min & WinGo 3 Min)
const games = [
  { code: "WinGo_1M", name: "WinGo 1 Min", lastPeriod: "" },
  { code: "WinGo_3M", name: "WinGo 3 Min", lastPeriod: "" }
];

// Basic Web Server to keep Render service Active 24/7
app.get('/', (req, res) => {
  res.send('DmFirst WinGo 1M & 3M Auto Result Worker is Active 24/7!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Function to fetch game results from DmFirst
async function fetchGameResult(game) {
  try {
    const API_URL = `https://www.dmfirst0.com/api/web/game/getHistory?gameCode=${game.code}`;
    
    // Authorization Headers using AUTH_TOKEN
    const response = await axios.get(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Authorization': AUTH_TOKEN ? `Bearer ${AUTH_TOKEN.trim()}` : '',
        'token': AUTH_TOKEN ? AUTH_TOKEN.trim() : ''
      }
    });

    if (response.data && response.data.data && response.data.data.list) {
      const latestGame = response.data.data.list[0];
      const period = latestGame.period || latestGame.issueNumber;
      const numberResult = parseInt(latestGame.number || latestGame.result);

      if (period && period !== game.lastPeriod) {
        game.lastPeriod = period;

        // Big / Small Calculation Logic (5-9 = WIN, 0-4 = LOSS)
        const resultType = (numberResult >= 5) ? "WIN" : "LOSS";

        // Forwarding to BotBusiness Telegram Receiver Command
        if (BOT_TOKEN) {
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/runCommand`, {
            command: "/api_result_receiver",
            options: {
              token: SECRET_TOKEN,
              period: String(period),
              result: resultType,
              platform: game.name
            }
          });
          console.log(`[SUCCESS] [${game.name}] Period: ${period} | Result: ${resultType}`);
        }
      }
    } else {
      console.log(`[WARNING] [${game.name}] Unexpected response or Invalid Token.`);
    }
  } catch (error) {
    console.error(`[ERROR] [${game.name}] Fetch Failed:`, error.message);
  }
}

// Continuous background monitoring loop every 10 seconds
setInterval(() => {
  games.forEach(game => fetchGameResult(game));
}, 10000);
