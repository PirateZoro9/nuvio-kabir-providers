/**
 * dudefilms - Built from src/dudefilms/
 * Generated: 2026-04-28T05:33:47.185Z
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
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
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
function syncDomain() {
  return __async(this, null, function* () {
    const now = Date.now();
    if (now - lastSync < 36e5)
      return activeDomain;
    try {
      console.log("[DudeFilms] Syncing domain...");
      const res = yield fetch(DOMAINS_URL);
      const data = yield res.json();
      if (data.dudefilms) {
        activeDomain = data.dudefilms.replace(/\/$/, "");
        lastSync = now;
      }
    } catch (e) {
      console.error(`[DudeFilms] Domain sync failed: ${e.message}`);
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
      const firstFileId = Object.keys(children)[0];
      const fileObj = children[firstFileId];
      return [{
        name: "Gofile",
        title: `Gofile - ${fileObj.name || "Direct"}`,
        url: fileObj.link,
        quality: "HD",
        headers: { "Cookie": `accountToken=${token}` }
      }];
    } catch (e) {
      return [];
    }
  });
}
function extractHubCloud(url) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, { headers: HEADERS });
      const html = yield res.text();
      const $ = cheerio.load(html);
      let downloadPage = $("#download").attr("href");
      if (!downloadPage)
        return [];
      if (!downloadPage.startsWith("http")) {
        const uri = new URL(url);
        downloadPage = `${uri.protocol}//${uri.host}/${downloadPage.replace(/^\//, "")}`;
      }
      const res2 = yield fetch(downloadPage, { headers: HEADERS });
      const html2 = yield res2.text();
      const $2 = cheerio.load(html2);
      const streams = [];
      $2("a.btn").each((_, el) => {
        const link = $2(el).attr("href");
        const label = $2(el).text().toLowerCase();
        if (!link)
          return;
        if (label.includes("fsl server")) {
          streams.push({
            name: "DudeFilms | FSL Server",
            title: `HubCloud - ${label.includes("1080") ? "1080p" : "720p"}`,
            url: link,
            quality: label.includes("1080") ? "1080p" : "720p",
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
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const domain = yield syncDomain();
      console.log(`[DudeFilms] Request: ${mediaType} ${tmdbId}`);
      const tmdbType = mediaType === "movie" ? "movie" : "tv";
      const tmdbRes = yield fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${"1865f43a0549ca50d341dd9ab8b29f49"}`);
      const meta = yield tmdbRes.json();
      const title = (meta.title || meta.name || "").toLowerCase();
      const searchUrl = `${domain}/?s=${encodeURIComponent(title)}`;
      const searchRes = yield fetch(searchUrl, { headers: HEADERS });
      const searchHtml = yield searchRes.text();
      const $ = cheerio.load(searchHtml);
      let postUrl = "";
      $("div.simple-grid-grid-post").each((_, el) => {
        const h3 = $(el).find("h3 a");
        const postTitle = h3.text().toLowerCase();
        const href = h3.attr("href");
        if (postTitle.includes(title)) {
          postUrl = href;
        }
      });
      if (!postUrl)
        return [];
      const postRes = yield fetch(postUrl, { headers: HEADERS });
      const postHtml = yield postRes.text();
      const $post = cheerio.load(postHtml);
      const buttonUrls = [];
      $post("a.maxbutton").each((_, el) => {
        const href = $post(el).attr("href");
        const text = $post(el).text().toLowerCase();
        if (href && !["zipfile", "torrent", "rar", "7z"].some((t) => text.includes(t))) {
          buttonUrls.push(href);
        }
      });
      const serverPagePromises = buttonUrls.map((u) => __async(this, null, function* () {
        try {
          const r = yield fetch(u, { headers: HEADERS });
          const h = yield r.text();
          const $$ = cheerio.load(h);
          const links = [];
          $$("a.maxbutton, a.maxbutton-ep").each((__, el) => {
            const link = $$(el).attr("href");
            const text = $$(el).text().toLowerCase();
            if (link) {
              if (mediaType === "tv") {
                if (text.includes(`episode ${episode}`) || text.includes(`ep ${episode}`) || text === episode.toString()) {
                  links.push(link);
                }
              } else {
                links.push(link);
              }
            }
          });
          return links;
        } catch (e) {
          return [];
        }
      }));
      const allServerUrls = (yield Promise.all(serverPagePromises)).flat();
      const streamPromises = allServerUrls.map((u) => __async(this, null, function* () {
        if (u.includes("hubcloud"))
          return yield extractHubCloud(u);
        if (u.includes("gofile.io"))
          return yield extractGofile(u);
        if (u.includes("hubcdn")) {
          try {
            const r = yield fetch(u, { headers: HEADERS });
            const h = yield r.text();
            const enc = h.match(/r=([A-Za-z0-9+/=]+)/);
            if (enc) {
              const dec = base64Decode(enc[1]);
              const final = dec.split("link=").pop();
              return [{ name: "DudeFilms | HubCDN", title: "Direct Stream", url: final, quality: "720p", headers: { "Referer": u } }];
            }
          } catch (e) {
          }
        }
        return [];
      }));
      const results = (yield Promise.all(streamPromises)).flat().filter((s) => s && s.url);
      return results.map((s) => {
        if (!s.url.includes(".") && !s.url.includes("?")) {
          s.url += "#.m3u8";
        }
        return s;
      });
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
