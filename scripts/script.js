const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const TOKEN = "8479088966:AAECfzmcwhHBFhq5KLcZPJpynPLAIx67uMc";
const bot = new TelegramBot(TOKEN, { polling: true });

const SIGNS = [
  { name: "Овен", value: "aries" },
  { name: "Телец", value: "taurus" },
  { name: "Близнецы", value: "gemini" },
  { name: "Рак", value: "cancer" },
  { name: "Лев", value: "leo" },
  { name: "Дева", value: "virgo" },
  { name: "Весы", value: "libra" },
  { name: "Скорпион", value: "scorpio" },
  { name: "Стрелец", value: "sagittarius" },
  { name: "Козерог", value: "capricorn" },
  { name: "Водолей", value: "aquarius" },
  { name: "Рыбы", value: "pisces" },
];

function getSignsKeyboard() {
  const rows = [];
  for (let i = 0; i < SIGNS.length; i += 3) {
    rows.push(
      SIGNS.slice(i, i + 3).map((sign) => ({
        text: sign.name,
        callback_data: sign.value,
      }))
    );
  }
  rows.push([{ text: "Все знаки", callback_data: "all" }]);
  return { inline_keyboard: rows };
}

async function getHoroscope(sign) {
  try {
    const res =
      await axios.post(`https://aztro.sameerkumar.website?sign=aries&day=today
`);
    return res.data.description;
  } catch (e) {
    return "Ошибка при получении гороскопа.";
  }
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Выберите ваш знак зодиака:", {
    reply_markup: getSignsKeyboard(),
  });
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const sign = query.data;

  if (sign === "all") {
    let text = "";
    for (const s of SIGNS) {
      const desc = await getHoroscope(s.value);
      text += `*${s.name}*: ${desc}\n\n`;
    }
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } else {
    const signObj = SIGNS.find((s) => s.value === sign);
    const desc = await getHoroscope(sign);
    bot.sendMessage(chatId, `*${signObj.name}*\n${desc}`, {
      parse_mode: "Markdown",
    });
  }
  bot.answerCallbackQuery(query.id);
});
