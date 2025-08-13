require("dotenv").config();
const https = require("https");
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

function getAxiosHttpAdapter() {
  try {
    return require("axios/lib/adapters/http");
  } catch (_) {}
  try {
    return require("axios/adapters/http");
  } catch (_) {}
  return undefined;
}

function fetchUrl(url) {
  const options = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  };
  return new Promise((resolve, reject) => {
    https
      .get(url, options, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          // Follow redirect
          const redirectUrl = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          res.resume();
          return resolve(fetchUrl(redirectUrl));
        }
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject)
      .setTimeout(20000, function () {
        this.destroy(new Error("Request timeout"));
      });
  });
}

async function fetchHoroscope(slug) {
  const url = `${BASE_URL}${slug}/day.html`;
  const data = await fetchUrl(url);
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
