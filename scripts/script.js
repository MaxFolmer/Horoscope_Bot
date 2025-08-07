require("dotenv").config();
const { translate } = require("@vitalets/google-translate-api");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const horoscopes = require("../data/horoscopes.json");

const TOKEN = process.env.TELEGRAM_TOKEN;
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

// Хранилище пользователей (userId: { sign, subscribed })
const users = {};

function getSignsKeyboard(prefix = "setsign_") {
  const rows = [];
  for (let i = 0; i < SIGNS.length; i += 3) {
    rows.push(
      SIGNS.slice(i, i + 3).map((sign) => ({
        text: sign.name,
        callback_data: prefix + sign.value,
      }))
    );
  }
  return { inline_keyboard: rows };
}

function getMenuKeyboard() {
  return {
    keyboard: [
      [{ text: "/today" }, { text: "/setmyhoroscope" }],
      [{ text: "/subscribe" }, { text: "/unsubscribe" }],
      [{ text: "/all" }],
      [{ text: "/help" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

async function translateToRussian(text) {
  try {
    const res = await translate(text, { to: "ru", client: "gtx", tld: "com" });
    console.log("Перевод:", res.text);
    return res.text;
  } catch (e) {
    console.log("Ошибка перевода:", e.message);
    return text;
  }
}

function getHoroscope(sign) {
  return horoscopes[sign] || "Гороскоп не найден!";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// /start
bot.onText(/\/start/, (msg) => {
  users[msg.from.id] = users[msg.from.id] || { sign: null, subscribed: false };
  bot.sendMessage(
    msg.chat.id,
    "Добро пожаловать в бота-гороскоп!\n\nВыберите свой знак зодиака через /setmyhoroscope или используйте /help для списка команд.",
    { reply_markup: getMenuKeyboard() }
  );
});

// /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Доступные команды:\n\n/start — начать работу\n/help — список команд\n/today — гороскоп на сегодня для вашего знака\n/setmyhoroscope — выбрать свой знак зодиака\n/subscribe — подписаться на ежедневную рассылку\n/unsubscribe — отменить подписку\n/menu — показать меню с кнопками`
  );
});

// /menu
bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, "Меню:", { reply_markup: getMenuKeyboard() });
});

// /setmyhoroscope
bot.onText(/\/setmyhoroscope/, (msg) => {
  bot.sendMessage(msg.chat.id, "Выберите ваш знак зодиака:", {
    reply_markup: getSignsKeyboard(),
  });
});

// Обработка выбора знака
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  if (query.data.startsWith("setsign_")) {
    const sign = query.data.replace("setsign_", "");
    users[userId] = users[userId] || { sign: null, subscribed: false };
    users[userId].sign = sign;
    bot.answerCallbackQuery(query.id, { text: "Знак сохранён!" });
    bot.sendMessage(
      chatId,
      `Ваш знак зодиака: *${SIGNS.find((s) => s.value === sign).name}*`,
      { parse_mode: "Markdown" }
    );
    return;
  }
});

// /today
bot.onText(/\/today/, async (msg) => {
  const user = users[msg.from.id];
  if (!user || !user.sign) {
    bot.sendMessage(msg.chat.id, "Сначала выберите знак через /setmyhoroscope");
    return;
  }
  const signObj = SIGNS.find((s) => s.value === user.sign);
  const desc = getHoroscope(user.sign);
  bot.sendMessage(msg.chat.id, `*${signObj.name}*\n${desc}`, {
    parse_mode: "Markdown",
  });
});

// /subscribe
bot.onText(/\/subscribe/, (msg) => {
  users[msg.from.id] = users[msg.from.id] || { sign: null, subscribed: false };
  if (!users[msg.from.id].sign) {
    bot.sendMessage(msg.chat.id, "Сначала выберите знак через /setmyhoroscope");
    return;
  }
  users[msg.from.id].subscribed = true;
  bot.sendMessage(
    msg.chat.id,
    "Вы подписаны на ежедневную рассылку гороскопа!"
  );
});

// /unsubscribe
bot.onText(/\/unsubscribe/, (msg) => {
  users[msg.from.id] = users[msg.from.id] || { sign: null, subscribed: false };
  users[msg.from.id].subscribed = false;
  bot.sendMessage(msg.chat.id, "Вы отписались от рассылки.");
});

// /all
bot.onText(/\/all/, async (msg) => {
  let texts = [];
  for (const s of SIGNS) {
    const desc = getHoroscope(s.value);
    texts.push(`*${s.name}*: ${desc}`);
  }
  // Разбиваем на сообщения по 3500 символов (чтобы не превышать лимит Telegram)
  let message = "";
  for (const t of texts) {
    if ((message + "\n\n" + t).length > 3500) {
      await bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
      message = t;
    } else {
      message += (message ? "\n\n" : "") + t;
    }
  }
  if (message) {
    await bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown" });
  }
});

// Ежедневная рассылка (демо: раз в 60 секунд)
setInterval(async () => {
  for (const userId in users) {
    const user = users[userId];
    if (user.subscribed && user.sign) {
      const signObj = SIGNS.find((s) => s.value === user.sign);
      const desc = getHoroscope(user.sign);
      await bot.sendMessage(userId, `*${signObj.name}*\n${desc}`, {
        parse_mode: "Markdown",
      });
      await sleep(1500); // 1.5 секунды между сообщениями
    }
  }
}, 86400 * 1000); //
