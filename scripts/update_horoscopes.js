require("dotenv").config();
const axios = require("axios");
// В Node 18 axios по умолчанию использует fetch/undici → падает из‑за отсутствия global File.
// Форсируем старый HTTP-адаптер Node, чтобы обойти проблему.
try {
  const httpAdapter = require("axios/lib/adapters/http");
  axios.defaults.adapter = httpAdapter;
} catch (_) {
  // игнорируем, если путь адаптера отличается — ниже в запросах можно будет переопределять при необходимости
}
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const SIGNS = {
  aries: "oven",
  taurus: "telets",
  gemini: "bliznetsi",
  cancer: "rac",
  leo: "lev",
  virgo: "deva",
  libra: "vesy",
  scorpio: "scorpion",
  sagittarius: "strelets",
  capricorn: "kozerog",
  aquarius: "vodoley",
  pisces: "riby",
};

const BASE_URL = "https://www.astrostar.ru/horoscopes/main/";

async function fetchHoroscope(slug) {
  const url = `${BASE_URL}${slug}/day.html`;
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const $ = cheerio.load(data);
  // Берём первый параграф на странице
  const text = $("p").first().text().trim();
  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readExistingHoroscopes(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.log("Не удалось прочитать существующие гороскопы:", e.message);
  }
  return null;
}

function normalizeObject(obj) {
  if (!obj || typeof obj !== "object") return {};
  const sortedKeys = Object.keys(obj).sort();
  const normalized = {};
  for (const k of sortedKeys) normalized[k] = obj[k];
  return normalized;
}

function isSameData(a, b) {
  return (
    JSON.stringify(normalizeObject(a)) === JSON.stringify(normalizeObject(b))
  );
}

async function fetchAllHoroscopes() {
  const result = {};
  for (const sign in SIGNS) {
    try {
      result[sign] = await fetchHoroscope(SIGNS[sign]);
      console.log(`Скачан гороскоп для ${sign}`);
    } catch (e) {
      result[sign] = "";
      console.log(`Ошибка для ${sign}:`, e.message);
    }
  }
  return result;
}

(async () => {
  const dataDir = path.join(__dirname, "../data");
  const filePath = path.join(dataDir, "horoscopes.json");

  const existing = readExistingHoroscopes(filePath);
  let current = await fetchAllHoroscopes();

  if (existing && isSameData(current, existing)) {
    console.log(
      "Данные на сайте совпадают с текущими. Повторная попытка через 10 минут..."
    );
    await sleep(10 * 60 * 1000);
    current = await fetchAllHoroscopes();
    if (existing && isSameData(current, existing)) {
      console.log(
        "После повторной попытки данные не изменились. Обновление пропущено."
      );
      return;
    }
  }

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2), "utf8");
  console.log("Гороскопы обновлены!");
})();
