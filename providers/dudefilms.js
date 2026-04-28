/**
 * dudefilms - Built from src/dudefilms/
 * Generated: 2026-04-28T07:06:43.680Z
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
function normalizeQuality(text) {
  const s = text.toLowerCase();
  if (/\b(4k|ds4k|uhd|2160p)\b/.test(s))
    return "2160p";
  if (/\b(1440p|qhd|2k)\b/.test(s))
    return "1440p";
  if (/\b(1080p|fullhd|fhd)\b/.test(s))
    return "1080p";
  if (/\b(720p|hd)\b/.test(s))
    return "720p";
  if (/\b(480p|sd|576p|540p)\b/.test(s))
    return "480p";
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
        quality: normalizeQuality(fileObj.name),
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
      if (!downloadPage && url.includes("hubcloud.php"))
        downloadPage = url;
      if (!downloadPage)
        return [];
      if (!downloadPage.startsWith("http")) {
        const host = url.split("/").slice(0, 3).join("/");
        downloadPage = host + "/" + downloadPage.replace(/^\//, "");
      }
      const res2 = yield fetch(downloadPage, { headers: HEADERS });
      const html2 = yield res2.text();
      const $2 = cheerio.load(html2);
      const fileName = $2("div.card-header").text() || "";
      const fileQuality = normalizeQuality(fileName);
      const streams = [];
      const btnPromises = [];
      $2("a.btn").each((_, el) => {
        const link = $2(el).attr("href");
        const label = $2(el).text().toLowerCase();
        if (!link)
          return;
        if (label.includes("fsl server") || label.includes("fslv2") || label.includes("pdl server") || label.includes("s3 server") || label.includes("mega server")) {
          streams.push({
            name: `DudeFilms | ${sourceTag}`,
            title: `${label.toUpperCase()} - ${fileQuality}`,
            url: link,
            quality: fileQuality,
            headers: HEADERS
          });
        } else if (label.includes("buzzserver")) {
          btnPromises.push((() => __async(this, null, function* () {
            try {
              const bRes = yield fetch(`${link}/download`, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": link }), redirect: "manual" });
              const dlink = bRes.headers.get("hx-redirect") || bRes.headers.get("HX-Redirect");
              if (dlink)
                return { name: "DudeFilms | BuzzServer", title: `Buzz - ${fileQuality}`, url: dlink, quality: fileQuality, headers: HEADERS };
            } catch (e) {
            }
            return null;
          }))());
        } else if (label.includes("pixeldra") || label.includes("pixel server")) {
          const pxId = link.split("/").pop();
          streams.push({
            name: "DudeFilms | PixelDrain",
            title: `Pixel - ${fileQuality}`,
            url: `https://pixeldrain.com/api/file/${pxId}?download`,
            quality: fileQuality,
            headers: HEADERS
          });
        }
      });
      const extra = yield Promise.all(btnPromises);
      return [...streams, ...extra.filter(Boolean)];
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
      const fileSize = $2("li.list-group-item:contains(Size)").text() || "";
      const fileQuality = normalizeQuality(fileName);
      const streams = [];
      const btnPromises = [];
      $2("div.text-center a").each((_, el) => {
        const link = $2(el).attr("href");
        const label = $2(el).text().toLowerCase();
        if (!link)
          return;
        if (label.includes("direct dl") || label.includes("instant dl")) {
          streams.push({
            name: "DudeFilms | GDFlix",
            title: `GD Direct [${fileSize.replace("Size : ", "")}] - ${fileQuality}`,
            url: link,
            quality: fileQuality,
            headers: HEADERS
          });
        } else if (label.includes("gofile")) {
          btnPromises.push(extractGofile(link));
        } else if (label.includes("pixeldrain")) {
          streams.push({ name: "DudeFilms | PixelDrain", title: `Pixel - ${fileQuality}`, url: link, quality: fileQuality, headers: HEADERS });
        }
      });
      ["type=1", "type=2"].forEach((t) => {
        btnPromises.push((() => __async(this, null, function* () {
          try {
            const cfUrl = targetUrl.replace("file", "wfile") + "?" + t;
            const cfRes = yield fetch(cfUrl, { headers: HEADERS });
            const cfHtml = yield cfRes.text();
            const cfLink = cheerio.load(cfHtml)("a.btn-success").attr("href");
            if (cfLink)
              return { name: "DudeFilms | GDFlix CF", title: `CF Backup - ${fileQuality}`, url: cfLink, quality: fileQuality, headers: HEADERS };
          } catch (e) {
          }
          return null;
        }))());
      });
      const extra = yield Promise.all(btnPromises);
      return [...streams, ...extra.flat().filter(Boolean)];
    } catch (e) {
      return [];
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const domain = yield syncDomain();
      const tmdbRes = yield fetch(`https://api.themoviedb.org/3/${mediaType === "movie" ? "movie" : "tv"}/${tmdbId}?api_key=${"1865f43a0549ca50d341dd9ab8b29f49"}`);
      const meta = yield tmdbRes.json();
      const title = (meta.title || meta.name || "").toLowerCase();
      const year = (meta.release_date || meta.first_air_date || "").split("-")[0];
      const searchRes = yield fetch(`${domain}/?s=${encodeURIComponent(title)}`, { headers: HEADERS });
      const searchHtml = yield searchRes.text();
      const $s = cheerio.load(searchHtml);
      let postUrl = "";
      $s("div.simple-grid-grid-post").each((_, el) => {
        const linkEl = $s(el).find("h3 a");
        const postTitle = linkEl.text().toLowerCase();
        const href = linkEl.attr("href");
        if (postTitle.includes(title) || title.includes(postTitle)) {
          if (!year || postTitle.includes(year))
            postUrl = href;
        }
      });
      if (!postUrl)
        return [];
      const postRes = yield fetch(postUrl, { headers: HEADERS });
      const postHtml = yield postRes.text();
      const $p = cheerio.load(postHtml);
      const btnUrls = [];
      $p("a.maxbutton").each((_, el) => {
        const href = $p(el).attr("href");
        const label = $p(el).text().toLowerCase();
        if (href && !["torrent", "rar", "zip", "7z"].some((t) => label.includes(t)))
          btnUrls.push(href);
      });
      const serverUrls = (yield Promise.all(btnUrls.map((u) => __async(this, null, function* () {
        try {
          const r = yield fetch(u, { headers: HEADERS });
          const h = yield r.text();
          const $d = cheerio.load(h);
          const links = [];
          $d("a.maxbutton, a.maxbutton-ep").each((__, el) => {
            const l = $d(el).attr("href");
            const t = $d(el).text().toLowerCase();
            if (!l)
              return;
            if (mediaType === "tv") {
              if (t.match(new RegExp(`\\b(ep|episode|e)\\s*${episode}\\b`, "i")) || t === episode.toString())
                links.push(l);
            } else
              links.push(l);
          });
          return links;
        } catch (e) {
          return [];
        }
      })))).flat();
      const finalStreams = (yield Promise.all([...new Set(serverUrls)].map((u) => __async(this, null, function* () {
        if (u.includes("hubcloud") || u.includes("shikshakdaak.com"))
          return yield extractHubCloud(u);
        if (u.includes("gdflix"))
          return yield extractGDFlix(u);
        if (u.includes("gofile.io"))
          return yield extractGofile(u);
        if (u.includes("pixeldrain")) {
          const pxId = u.split("/").pop();
          return [{ name: "DudeFilms | PixelDrain", title: "Direct DL", url: `https://pixeldrain.com/api/file/${pxId}?download`, quality: "HD", headers: HEADERS }];
        }
        if (u.includes("hubcdn")) {
          try {
            const r = yield fetch(u, { headers: HEADERS });
            const h = yield r.text();
            const enc = h.match(/r=([A-Za-z0-9+/=]+)/);
            if (enc) {
              const m3u8 = base64Decode(enc[1]).split("link=").pop();
              return [{ name: "DudeFilms | HubCDN", title: "Direct Stream", url: m3u8, quality: "720p", headers: { "Referer": u } }];
            }
          } catch (e) {
          }
        }
        return [];
      })))).flat().filter((s) => s && s.url);
      const unique = [];
      const seen = /* @__PURE__ */ new Set();
      finalStreams.forEach((s) => {
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
