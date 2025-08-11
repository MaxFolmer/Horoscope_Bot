require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const horoscopes = require("../data/horoscopes.json");
const cron = require("node-cron");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });
const ADMIN_ID = 700953345;

function isAdmin(userId) {
  return String(userId) === String(ADMIN_ID);
}

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

// Путь к файлу с пользователями
const USERS_FILE = path.join(__dirname, "../data/users.json");

// Функция для загрузки пользователей из файла
function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Ошибка загрузки пользователей:", error.message);
  }
  return {};
}

// Функция для сохранения пользователей в файл
function saveUsers() {
  try {
    // Создаем папку data если её нет
    const dataDir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
    console.log("Пользователи сохранены в файл");
  } catch (error) {
    console.error("Ошибка сохранения пользователей:", error.message);
  }
}

// Хранилище пользователей (userId: { sign, subscribed, notificationTime })
const users = loadUsers();
console.log(`Загружено ${Object.keys(users).length} пользователей`);

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

function getTimeKeyboard() {
  const times = [
    "01:00",
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
    "22:00",
    "23:00",
  ];

  const rows = [];
  for (let i = 0; i < times.length; i += 3) {
    rows.push(
      times.slice(i, i + 3).map((time) => ({
        text: time,
        callback_data: "settime_" + time,
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
      [{ text: "/settime" }, { text: "/all" }],
      [{ text: "/help" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function getHoroscope(sign) {
  return horoscopes[sign] || "Гороскоп не найден!";
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
    `Доступные команды:\n\n/start — начать работу\n/help — список команд\n/today — гороскоп на сегодня для вашего знака\n/setmyhoroscope — выбрать свой знак зодиака\n/settime — установить время уведомлений\n/subscribe — подписаться на ежедневную рассылку\n/unsubscribe — отменить подписку\n/menu — показать меню с кнопками\n/test-update — тест обновления гороскопов (для админа)\n/stats — статистика пользователей (для админа)`
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

// /settime
bot.onText(/\/settime/, (msg) => {
  const user = users[msg.from.id];
  const currentTime = user ? user.notificationTime || "08:00" : "08:00";

  bot.sendMessage(
    msg.chat.id,
    `⏰ Выберите время для ежедневных уведомлений\n\nТекущее время: *${currentTime}* по Москве`,
    {
      reply_markup: getTimeKeyboard(),
      parse_mode: "Markdown",
    }
  );
});

// Обработка выбора знака
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  if (query.data.startsWith("setsign_")) {
    const sign = query.data.replace("setsign_", "");
    users[userId] = users[userId] || {
      sign: null,
      subscribed: false,
      notificationTime: "08:00",
    };
    users[userId].sign = sign;
    saveUsers(); // Сохраняем изменения
    bot.answerCallbackQuery(query.id, { text: "Знак сохранён!" });
    bot.sendMessage(
      chatId,
      `Ваш знак зодиака: *${SIGNS.find((s) => s.value === sign).name}*`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (query.data.startsWith("settime_")) {
    const time = query.data.replace("settime_", "");
    users[userId] = users[userId] || {
      sign: null,
      subscribed: false,
      notificationTime: "08:00",
    };
    users[userId].notificationTime = time;
    saveUsers(); // Сохраняем изменения
    bot.answerCallbackQuery(query.id, { text: "Время сохранено!" });
    bot.sendMessage(
      chatId,
      `⏰ Время уведомлений установлено на *${time}* по Москве`,
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
  users[msg.from.id] = users[msg.from.id] || {
    sign: null,
    subscribed: false,
    notificationTime: "08:00",
  };
  if (!users[msg.from.id].sign) {
    bot.sendMessage(msg.chat.id, "Сначала выберите знак через /setmyhoroscope");
    return;
  }
  users[msg.from.id].subscribed = true;
  saveUsers(); // Сохраняем изменения
  scheduleUserNotifications(); // Обновляем расписание
  bot.sendMessage(
    msg.chat.id,
    "Вы подписаны на ежедневную рассылку гороскопа!"
  );
});

// /unsubscribe
bot.onText(/\/unsubscribe/, (msg) => {
  users[msg.from.id] = users[msg.from.id] || {
    sign: null,
    subscribed: false,
    notificationTime: "08:00",
  };
  users[msg.from.id].subscribed = false;
  saveUsers(); // Сохраняем изменения
  scheduleUserNotifications(); // Обновляем расписание
  bot.sendMessage(msg.chat.id, "Вы отписались от рассылки.");
});

// /stats - статистика пользователей (для админа)
bot.onText(/\/stats/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, "❌ Доступ запрещён");
    return;
  }
  const totalUsers = Object.keys(users).length;
  const subscribedUsers = Object.values(users).filter(
    (user) => user.subscribed
  ).length;
  const usersWithSigns = Object.values(users).filter(
    (user) => user.sign
  ).length;

  const stats = `📊 Статистика бота:\n\n👥 Всего пользователей: ${totalUsers}\n✅ С выбранным знаком: ${usersWithSigns}\n📧 Подписанных на рассылку: ${subscribedUsers}`;

  bot.sendMessage(msg.chat.id, stats);
});

// /test-update - тестовая команда для проверки автообновления (только админ)
bot.onText(/\/test-update/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    bot.sendMessage(msg.chat.id, "❌ Доступ запрещён");
    return;
  }
  console.log("Тестовый запуск обновления гороскопов...");
  execFile(
    process.execPath,
    [path.join(__dirname, "update_horoscopes.js")],
    { cwd: __dirname },
    (err, stdout, stderr) => {
      if (err) {
        console.error("Ошибка тестового обновления:", err);
        bot.sendMessage(msg.chat.id, "❌ Ошибка обновления: " + err.message);
      } else {
        console.log("Тестовое обновление успешно:", stdout);
        // Перезагружаем данные в памяти
        try {
          delete require.cache[require.resolve("../data/horoscopes.json")];
          Object.assign(horoscopes, require("../data/horoscopes.json"));
          console.log("Данные гороскопов перезагружены в памяти");
          bot.sendMessage(msg.chat.id, "✅ Гороскопы успешно обновлены!");
        } catch (e) {
          console.error("Ошибка перезагрузки данных:", e.message);
          bot.sendMessage(
            msg.chat.id,
            "❌ Ошибка перезагрузки данных: " + e.message
          );
        }
      }
    }
  );
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

// Ежедневная рассылка с индивидуальным временем
function scheduleUserNotifications() {
  // Очищаем старые расписания
  if (global.userSchedules) {
    Object.values(global.userSchedules).forEach((job) => job.cancel());
  }
  global.userSchedules = {};

  // Создаем расписание для каждого пользователя
  for (const userId in users) {
    const user = users[userId];
    if (user.subscribed && user.sign && user.notificationTime) {
      const [hour, minute] = user.notificationTime.split(":").map(Number);

      const job = cron.schedule(
        `${minute} ${hour} * * *`,
        async () => {
          try {
            const signObj = SIGNS.find((s) => s.value === user.sign);
            const desc = getHoroscope(user.sign);
            await bot.sendMessage(userId, `*${signObj.name}*\n${desc}`, {
              parse_mode: "Markdown",
            });
            console.log(
              `Отправлен гороскоп пользователю ${userId} в ${user.notificationTime}`
            );
          } catch (error) {
            console.error(
              `Ошибка отправки гороскопа пользователю ${userId}:`,
              error.message
            );
          }
        },
        {
          timezone: "Europe/Moscow",
        }
      );

      global.userSchedules[userId] = job;
      console.log(
        `Расписание создано для пользователя ${userId} на ${user.notificationTime}`
      );
    }
  }
}

// Запускаем расписание при старте
scheduleUserNotifications();

// Автообновление гороскопов каждый день в 00:30 по Москве
cron.schedule(
  "30 0 * * *",
  () => {
    console.log("Запуск автообновления гороскопов...");
    execFile(
      process.execPath,
      [path.join(__dirname, "update_horoscopes.js")],
      { cwd: __dirname },
      (err, stdout, stderr) => {
        if (err) {
          console.error("Ошибка автообновления гороскопов:", err);
        } else {
          console.log("Гороскопы успешно обновлены:", stdout);
          // Перезагружаем данные в памяти
          try {
            delete require.cache[require.resolve("../data/horoscopes.json")];
            Object.assign(horoscopes, require("../data/horoscopes.json"));
            console.log("Данные гороскопов перезагружены в памяти");
          } catch (e) {
            console.error("Ошибка перезагрузки данных:", e.message);
          }
        }
      }
    );
  },
  {
    timezone: "Europe/Moscow",
  }
);

console.log("Автообновление гороскопов настроено на 00:30 по Москве");
