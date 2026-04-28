/**
 * dudefilms - Built from src/dudefilms/
 * Generated: 2026-04-28T06:52:30.600Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/dudefilms/index.js
var cheerio = require("cheerio-without-node-native");
var DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
var FALLBACK_MAIN_URL = "https://dudefilms.sarl";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
};
var activeDomain = FALLBACK_MAIN_URL;
var lastSync = 0;
function base64Decode(str) {
  if (typeof atob !== "undefined")
    return atob(str);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  str = String(str).replace(/=+$/, "");
  for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}
function getQuality(text) {
  const match = text.match(/\b(2160|1440|1080|720|576|540|480)\s*[pP]\b/);
  if (match)
    return match[1] + "p";
  if (text.toLowerCase().includes("4k"))
    return "2160p";
  if (text.toLowerCase().includes("2k"))
    return "1440p";
  return "720p";
}
function syncDomain() {
  return __async(this, null, function* () {
    const now = Date.now();
    if (now - lastSync < 36e5)
      return activeDomain;
    try {
      const res = yield fetch(DOMAINS_URL);
      const data = yield res.json();
      if (data.dudefilms) {
        activeDomain = data.dudefilms.replace(/\/$/, "");
        lastSync = now;
      }
    } catch (e) {
    }
    return activeDomain;
  });
}
function extractGofile(url) {
  return __async(this, null, function* () {
    try {
      const idMatch = url.match(/\/(?:\?c=|d\/)([\da-zA-Z-]+)/);
      if (!idMatch)
        return [];
      const id = idMatch[1];
      const acctRes = yield fetch("https://api.gofile.io/accounts", { method: "POST", headers: HEADERS });
      const acctData = yield acctRes.json();
      const token = acctData.data.token;
      const jsRes = yield fetch("https://gofile.io/dist/js/global.js", { headers: HEADERS });
      const jsText = yield jsRes.text();
      const wtMatch = jsText.match(/appdata\.wt\s*=\s*["']([^"']+)["']/);
      if (!wtMatch)
        return [];
      const wt = wtMatch[1];
      const fileRes = yield fetch(`https://api.gofile.io/contents/${id}?wt=${wt}`, {
        headers: __spreadProps(__spreadValues({}, HEADERS), { "Authorization": `Bearer ${token}` })
      });
      const fileData = yield fileRes.json();
      const children = fileData.data.children;
      return Object.values(children).filter((f) => f.type === "file").map((fileObj) => ({
        name: "DudeFilms | Gofile",
        title: `Gofile - ${fileObj.name}`,
        url: fileObj.link,
        quality: getQuality(fileObj.name),
        headers: { "Cookie": `accountToken=${token}` }
      }));
    } catch (e) {
      return [];
    }
  });
}
function extractHubCloud(url, sourceTag = "HubCloud") {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, { headers: HEADERS });
      const html = yield res.text();
      const $ = cheerio.load(html);
      let downloadPage = $("#download").attr("href");
      if (!downloadPage) {
        if (url.includes("hubcloud.php"))
          downloadPage = url;
        else
          return [];
      }
      if (downloadPage && !downloadPage.startsWith("http")) {
        const host = url.split("/").slice(0, 3).join("/");
        downloadPage = host + "/" + downloadPage.replace(/^\//, "");
      }
      const res2 = yield fetch(downloadPage, { headers: HEADERS });
      const html2 = yield res2.text();
      const $2 = cheerio.load(html2);
      const fileName = $2("div.card-header").text() || "";
      const quality = getQuality(fileName);
      const streams = [];
      $2("a.btn").each((_, el) => {
        const link = $2(el).attr("href");
        const label = $2(el).text().toLowerCase();
        if (!link)
          return;
        if (label.includes("fsl server") || label.includes("fslv2") || label.includes("pdl server") || label.includes("direct dl")) {
          streams.push({
            name: `DudeFilms | ${sourceTag}`,
            title: `${label.toUpperCase()} - ${quality}`,
            url: link,
            quality,
            headers: HEADERS
          });
        } else if (label.includes("pixeldra") || label.includes("pixel server")) {
          const pxId = link.split("/").pop();
          streams.push({
            name: `DudeFilms | PixelDrain`,
            title: `PixelDrain - ${quality}`,
            url: `https://pixeldrain.com/api/file/${pxId}?download`,
            quality,
            headers: HEADERS
          });
        }
      });
      return streams;
    } catch (e) {
      return [];
    }
  });
}
function extractGDFlix(url) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, { headers: HEADERS });
      const html = yield res.text();
      const $ = cheerio.load(html);
      const refresh = $('meta[http-equiv="refresh"]').attr("content");
      let targetUrl = url;
      if (refresh && refresh.includes("url="))
        targetUrl = refresh.split("url=").pop();
      const res2 = yield fetch(targetUrl, { headers: HEADERS });
      const html2 = yield res2.text();
      const $2 = cheerio.load(html2);
      const fileName = $2("li.list-group-item:contains(Name)").text() || "";
      const quality = getQuality(fileName);
      const streams = [];
      const buttonPromises = [];
      $2("div.text-center a").each((_, el) => {
        const link = $2(el).attr("href");
        const label = $2(el).text().toLowerCase();
        if (!link)
          return;
        if (label.includes("direct dl") || label.includes("instant dl")) {
          streams.push({
            name: "DudeFilms | GDFlix",
            title: `GDFlix Direct - ${quality}`,
            url: link,
            quality,
            headers: HEADERS
          });
        } else if (label.includes("gofile")) {
          buttonPromises.push(extractGofile(link));
        } else if (label.includes("pixeldrain")) {
          streams.push({
            name: "DudeFilms | PixelDrain",
            title: `PixelDrain - ${quality}`,
            url: link,
            quality,
            headers: HEADERS
          });
        }
      });
      const extraResults = yield Promise.all(buttonPromises);
      return [...streams, ...extraResults.flat()];
    } catch (e) {
      return [];
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const domain = yield syncDomain();
      console.log(`[DudeFilms] Request: ${mediaType} ${tmdbId}`);
      const tmdbRes = yield fetch(`https://api.themoviedb.org/3/${mediaType === "movie" ? "movie" : "tv"}/${tmdbId}?api_key=${"1865f43a0549ca50d341dd9ab8b29f49"}`);
      const meta = yield tmdbRes.json();
      const title = (meta.title || meta.name || "").toLowerCase();
      const year = (meta.release_date || meta.first_air_date || "").split("-")[0];
      const searchRes = yield fetch(`${domain}/?s=${encodeURIComponent(title)}`, { headers: HEADERS });
      const searchHtml = yield searchRes.text();
      const $search = cheerio.load(searchHtml);
      let postUrl = "";
      $search("div.simple-grid-grid-post").each((_, el) => {
        const linkEl = $search(el).find("h3 a");
        const postTitle = linkEl.text().toLowerCase();
        const href = linkEl.attr("href");
        if (postTitle.includes(title) || title.includes(postTitle)) {
          if (!year || postTitle.includes(year)) {
            postUrl = href;
          }
        }
      });
      if (!postUrl) {
        const shortTitle = title.split(" ")[0];
        if (shortTitle.length > 3) {
          const fbRes = yield fetch(`${domain}/?s=${encodeURIComponent(shortTitle)}`, { headers: HEADERS });
          const fbHtml = yield fbRes.text();
          const $fb = cheerio.load(fbHtml);
          $fb("div.simple-grid-grid-post h3 a").each((_, el) => {
            if ($fb(el).text().toLowerCase().includes(title))
              postUrl = $fb(el).attr("href");
          });
        }
      }
      if (!postUrl)
        return [];
      const postRes = yield fetch(postUrl, { headers: HEADERS });
      const postHtml = yield postRes.text();
      const $post = cheerio.load(postHtml);
      const serverLinks = [];
      $post("a.maxbutton").each((_, el) => {
        const href = $post(el).attr("href");
        const label = $post(el).text().toLowerCase();
        if (href && !["torrent", "rar", "zip", "7z"].some((t) => label.includes(t))) {
          serverLinks.push(href);
        }
      });
      const drillResults = yield Promise.all(serverLinks.map((u) => __async(this, null, function* () {
        try {
          const r = yield fetch(u, { headers: HEADERS });
          const h = yield r.text();
          const $drill = cheerio.load(h);
          const results = [];
          $drill("a.maxbutton, a.maxbutton-ep").each((__, el) => {
            const link = $drill(el).attr("href");
            const text = $drill(el).text().toLowerCase();
            if (!link)
              return;
            if (mediaType === "tv") {
              if (text.match(new RegExp(`\\b(ep|episode|e)\\s*${episode}\\b`, "i")) || text === episode.toString()) {
                results.push(link);
              }
            } else {
              results.push(link);
            }
          });
          return results;
        } catch (e) {
          return [];
        }
      })));
      const finalServerUrls = [...new Set(drillResults.flat())];
      const extractionResults = yield Promise.all(finalServerUrls.map((u) => __async(this, null, function* () {
        if (u.includes("hubcloud") || u.includes("shikshakdaak.com"))
          return yield extractHubCloud(u);
        if (u.includes("gdflix"))
          return yield extractGDFlix(u);
        if (u.includes("gofile.io"))
          return yield extractGofile(u);
        if (u.includes("pixeldrain")) {
          return [{ name: "DudeFilms | PixelDrain", title: "Direct Download", url: u, quality: "HD", headers: HEADERS }];
        }
        if (u.includes("hubcdn")) {
          try {
            const r = yield fetch(u, { headers: HEADERS });
            const h = yield r.text();
            const enc = h.match(/r=([A-Za-z0-9+/=]+)/);
            if (enc) {
              const dec = base64Decode(enc[1]);
              const final = dec.split("link=").pop();
              return [{ name: "DudeFilms | HubCDN", title: "Direct Stream", url: final, quality: "HD", headers: { "Referer": u } }];
            }
          } catch (e) {
          }
        }
        return [];
      })));
      const rawStreams = extractionResults.flat().filter((s) => s && s.url);
      const unique = [];
      const seen = /* @__PURE__ */ new Set();
      rawStreams.forEach((s) => {
        if (!seen.has(s.url)) {
          seen.add(s.url);
          if (!s.url.includes(".") && !s.url.includes("?"))
            s.url += "#.m3u8";
          unique.push(s);
        }
      });
      return unique;
    } catch (e) {
      console.error(`[DudeFilms] Fatal Error: ${e.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
if (typeof global !== "undefined") {
  global.getStreams = getStreams;
}
