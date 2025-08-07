const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

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

(async () => {
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
  if (!fs.existsSync("./data")) fs.mkdirSync("./data");
  fs.writeFileSync(
    "./data/horoscopes.json",
    JSON.stringify(result, null, 2),
    "utf8"
  );
  console.log("Гороскопы обновлены!");
})();
