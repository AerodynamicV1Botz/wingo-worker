const axios = require('axios');

// Environment variables se credentials load honge
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOTBUSINESS_BOT_TOKEN";
const SECRET_TOKEN = process.env.SECRET_TOKEN || "AapkaSecretToken123";
const GAME_USER = process.env.GAME_USERNAME;
const GAME_PASS = process.env.GAME_PASSWORD;

async function fetchAndSendResult() {
  try {
    // Platform API URL jahan se result milega
    const response = await axios.get("https://your-game-platform-api.com/getHistory");

    if (response.data && response.data.lastResult) {
      const period = response.data.lastResult.period;
      const resultType = response.data.lastResult.type; // WIN ya LOSS

      // BotBusiness Webhook endpoint call
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/runCommand`, {
        command: "/api_result_receiver",
        options: {
          token: SECRET_TOKEN,
          period: period,
          result: resultType,
          platform: "DmFirst Game"
        }
      });

      console.log(`Result sent successfully for period: ${period}`);
    }
  } catch (error) {
    console.error("Error fetching result:", error.message);
  }
}

// Har 1 min (60000 ms) mein auto-fetch chalega
setInterval(fetchAndSendResult, 60000);
