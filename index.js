const axios = require('axios');

// Environment Variables se variables read honge
const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_TOKEN = process.env.SECRET_TOKEN || "AapkaSecretToken123";

// DmFirst WinGo Public Result History Endpoint
const API_URL = "https://www.dmfirst0.com/api/web/game/getHistory?gameCode=WinGo_30S";

var lastProcessedPeriod = "";

async function fetchAndSendResult() {
  try {
    const response = await axios.get(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    if (response.data && response.data.data && response.data.data.list) {
      const latestGame = response.data.data.list[0];
      const period = latestGame.period || latestGame.issueNumber;
      const numberResult = parseInt(latestGame.number || latestGame.result);

      // Agar new period ka result aaya hai tabhi process karo
      if (period && period !== lastProcessedPeriod) {
        lastProcessedPeriod = period;

        // Big / Small Calculation (5-9 = BIG / WIN, 0-4 = SMALL)
        var resultType = (numberResult >= 5) ? "WIN" : "LOSS";

        // Telegram BotBusiness Receiver Command par request bhejna
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/runCommand`, {
          command: "/api_result_receiver",
          options: {
            token: SECRET_TOKEN,
            period: String(period),
            result: resultType,
            platform: "DmFirst Game"
          }
        });

        console.log(`[SUCCESS] Period: ${period} | Result: ${resultType}`);
      }
    }
  } catch (error) {
    console.error("[ERROR] Result fetch fail:", error.message);
  }
}

// WinGo 30S ke liye har 10-15 seconds me check chalega
setInterval(fetchAndSendResult, 15000);
