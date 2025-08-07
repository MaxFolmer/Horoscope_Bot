const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const { translate } = require("@vitalets/google-translate-api");

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

async function translateToRussian(text) {
  try {
    const res = await translate(text, { to: "ru" });
    console.log("Перевод:", res.text);
    return res.text;
  } catch (e) {
    console.log("Ошибка перевода:", e.message);
    return text;
  }
}

async function getHoroscope(sign) {
  try {
    const res = await axios.get(`https://ohmanda.com/api/horoscope/${sign}/`);
    console.log("Ответ от ohmanda:", res.data);
    if (!res.data || !res.data.horoscope) {
      return "Гороскоп не найден.";
    }
    const original = res.data.horoscope;
    const translated = await translateToRussian(original);
    console.log("Оригинал:", original);
    console.log("Перевод:", translated);
    return translated || original;
  } catch (e) {
    console.log(
      "Ошибка запроса к API:",
      e.response ? e.response.data : e.message
    );
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

  // Сразу отвечаем на callback_query
  bot.answerCallbackQuery(query.id);

  if (sign === "all") {
    let texts = [];
    for (const s of SIGNS) {
      const desc = await getHoroscope(s.value);
      texts.push(`*${s.name}*: ${desc}`);
    }
    // Разбиваем на сообщения по 3500 символов (чтобы не превышать лимит Telegram)
    let message = "";
    for (const t of texts) {
      if ((message + "\n\n" + t).length > 3500) {
        await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
        message = t;
      } else {
        message += (message ? "\n\n" : "") + t;
      }
    }
    if (message) {
      await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    }
  } else {
    const signObj = SIGNS.find((s) => s.value === sign);
    const desc = await getHoroscope(sign);
    bot.sendMessage(chatId, `*${signObj.name}*\n${desc}`, {
      parse_mode: "Markdown",
    });
  }
});
