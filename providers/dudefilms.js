/**
 * dudefilms - Built from src/dudefilms/
 * Generated: 2026-04-29T08:03:20.793Z
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
function getOrigin(url) {
  try {
    const uri = new URL(url);
    return `${uri.protocol}//${uri.host}`;
  } catch (e) {
    return "";
  }
}
function absoluteUrl(baseUrl, href) {
  if (!href)
    return "";
  if (href.startsWith("http"))
    return href;
  const origin = getOrigin(baseUrl);
  if (!origin)
    return href;
  return `${origin}/${href.replace(/^\//, "")}`;
}
function calculateTitleSimilarity(title1, title2, year1, year2) {
  const normalize = (t) => t.toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
  const t1 = normalize(title1);
  const t2 = normalize(title2);
  const set1 = new Set(t1.split(" "));
  const set2 = new Set(t2.split(" "));
  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  let score = intersection.size / set1.size;
  if (year1 && year2 && year1 === year2) {
    score += 0.2;
  }
  return score;
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
      const jsRes = yield fetch("https://gofile.io/dist/js/config.js", { headers: HEADERS });
      const jsText = yield jsRes.text();
      const wtMatch = jsText.match(/appdata\.wt\s*=\s*["']([^"']+)["']/);
      if (!wtMatch)
        return [];
      const wt = wtMatch[1];
      const fileRes = yield fetch(`https://api.gofile.io/contents/${id}?contentFilter=&page=1&pageSize=1000&sortField=name&sortDirection=1`, {
        headers: __spreadProps(__spreadValues({}, HEADERS), { "Authorization": `Bearer ${token}`, "X-Website-Token": wt })
      });
      const fileData = yield fileRes.json();
      const children = fileData.data.children;
      return Object.values(children).filter((f) => f.type === "file").map((fileObj) => ({
        name: "DudeFilms | Gofile",
        title: `Gofile - ${fileObj.name}`,
        url: fileObj.link,
        quality: normalizeQuality(fileObj.name),
        headers: __spreadProps(__spreadValues({}, HEADERS), { "Cookie": `accountToken=${token}` })
      }));
    } catch (e) {
      return [];
    }
  });
}
function extractGofileFromWrapper(url) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, { headers: HEADERS });
      const html = yield res.text();
      const $ = cheerio.load(html);
      const tasks = [];
      $(".row .row a, a").each((_, el) => {
        const link = $(el).attr("href");
        if (link && link.includes("gofile")) {
          tasks.push(extractGofile(link));
        }
      });
      const results = yield Promise.all(tasks);
      return results.flat();
    } catch (e) {
      return [];
    }
  });
}
function extractGDFlixIndexLinks(link, fileSize, fileQuality) {
  return __async(this, null, function* () {
    try {
      const base = "https://new6.gdflix.dad";
      const indexUrl = link.startsWith("http") ? link : `${base}${link}`;
      const indexRes = yield fetch(indexUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": base + "/" }) });
      const indexHtml = yield indexRes.text();
      const $index = cheerio.load(indexHtml);
      const sourceTasks = [];
      $index("a.btn.btn-outline-info").each((_, btn) => {
        const href = $index(btn).attr("href");
        if (!href)
          return;
        const serverUrl = href.startsWith("http") ? href : `${base}${href}`;
        sourceTasks.push((() => __async(this, null, function* () {
          try {
            const serverRes = yield fetch(serverUrl, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": indexUrl }) });
            const serverHtml = yield serverRes.text();
            const $server = cheerio.load(serverHtml);
            const streams = [];
            $server("div.mb-4 > a").each((__, sourceAnchor) => {
              const sourceUrl = $server(sourceAnchor).attr("href");
              if (sourceUrl) {
                streams.push({
                  name: "DudeFilms | GDFlix Index",
                  title: `GD Index [${fileSize}] - ${fileQuality}`,
                  url: sourceUrl,
                  quality: fileQuality,
                  headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": serverUrl, "Origin": base })
                });
              }
            });
            return streams;
          } catch (e) {
            return [];
          }
        }))());
      });
      const results = yield Promise.all(sourceTasks);
      return results.flat();
    } catch (e) {
      return [];
    }
  });
}
function extractDriveBot(driveLink, fileSize, fileQuality) {
  return __async(this, null, function* () {
    try {
      const id = (driveLink.split("id=")[1] || "").split("&")[0];
      const doId = (driveLink.split("do=")[1] || "").split("==")[0];
      if (!id || !doId)
        return [];
      const baseUrls = ["https://drivebot.sbs", "https://drivebot.cfd"];
      const tasks = baseUrls.map((baseUrl) => __async(this, null, function* () {
        try {
          const indexbotLink = `${baseUrl}/download?id=${id}&do=${doId}`;
          const indexRes = yield fetch(indexbotLink, { headers: HEADERS });
          if (!indexRes.ok)
            return [];
          const cookieHeader = indexRes.headers.get("set-cookie") || "";
          const cookieMatch = cookieHeader.match(/PHPSESSID=([^;]+)/);
          const sessionCookie = cookieMatch ? cookieMatch[1] : "";
          const indexHtml = yield indexRes.text();
          const tokenMatch = indexHtml.match(/formData\.append\('token',\s*'([a-f0-9]+)'\)/);
          const postIdMatch = indexHtml.match(/fetch\('\/download\?id=([a-zA-Z0-9/+]+)'/);
          if (!tokenMatch || !postIdMatch)
            return [];
          const postRes = yield fetch(`${baseUrl}/download?id=${postIdMatch[1]}`, {
            method: "POST",
            headers: __spreadValues(__spreadProps(__spreadValues({}, HEADERS), {
              "Content-Type": "application/x-www-form-urlencoded",
              "Referer": indexbotLink
            }), sessionCookie ? { "Cookie": `PHPSESSID=${sessionCookie}` } : {}),
            body: `token=${encodeURIComponent(tokenMatch[1])}`
          });
          const postText = yield postRes.text();
          const downloadMatch = postText.match(/url":"(.*?)"/);
          const downloadLink = downloadMatch ? downloadMatch[1].replace(/\\/g, "") : "";
          if (!downloadLink)
            return [];
          return [{
            name: "DudeFilms | GDFlix DriveBot",
            title: `DriveBot [${fileSize}] - ${fileQuality}`,
            url: downloadLink,
            quality: fileQuality,
            headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": baseUrl + "/", "Origin": baseUrl })
          }];
        } catch (e) {
          return [];
        }
      }));
      const results = yield Promise.all(tasks);
      return results.flat();
    } catch (e) {
      return [];
    }
  });
}
function extractHubdrive(url) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, { headers: HEADERS });
      const html = yield res.text();
      const $ = cheerio.load(html);
      const href = $(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href");
      if (!href)
        return [];
      const resolved = absoluteUrl(url, href);
      if (resolved.includes("hubcloud"))
        return extractHubCloud(resolved, "HubDrive");
      return extractNestedHoster(resolved);
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
      let downloadPage = "";
      if (url.includes("hubcloud.php")) {
        downloadPage = url;
      } else {
        const raw = $("#download").attr("href");
        if (raw) {
          if (raw.startsWith("http"))
            downloadPage = raw;
          else {
            const uri = new URL(url);
            downloadPage = `${uri.protocol}//${uri.host}/${raw.replace(/^\//, "")}`;
          }
        }
      }
      if (!downloadPage)
        return [];
      const res2 = yield fetch(downloadPage, { headers: HEADERS });
      const html2 = yield res2.text();
      const $2 = cheerio.load(html2);
      const fileName = $2("div.card-header").text() || $2("li:contains(Name)").text() || $2("h1").text() || "";
      const fileSize = $2("i#size").text() || $2("li:contains(Size)").text() || "";
      const fileQuality = normalizeQuality(fileName);
      const streams = [];
      const btnPromises = [];
      const labelExtras = `[${fileQuality}]${fileSize ? ` [${fileSize.replace(/Size\s*:\s*/i, "").trim()}]` : ""}`;
      $2("a.btn").each((_, el) => {
        const link = $2(el).attr("href");
        const text = $2(el).text().toLowerCase();
        if (!link)
          return;
        if (text.includes("fsl server") || text.includes("fslv2") || text.includes("pdl server") || text.includes("s3 server") || text.includes("mega server") || text.includes("download file")) {
          streams.push({
            name: `DudeFilms | ${sourceTag}`,
            title: `${text.toUpperCase().split("\n")[0].trim()} ${labelExtras}`,
            url: link,
            quality: fileQuality,
            headers: HEADERS
          });
        } else if (text.includes("buzzserver")) {
          btnPromises.push((() => __async(this, null, function* () {
            try {
              const bRes = yield fetch(`${link}/download`, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": link }), redirect: "manual" });
              const dlink = bRes.headers.get("hx-redirect") || bRes.headers.get("HX-Redirect");
              if (dlink)
                return { name: "DudeFilms | BuzzServer", title: `BuzzServer ${labelExtras}`, url: dlink, quality: fileQuality, headers: HEADERS };
            } catch (e) {
            }
            return null;
          }))());
        } else if (text.includes("pixeldra") || text.includes("pixel server") || text.includes("pixelserver")) {
          const pxId = link.split("/").pop();
          streams.push({
            name: "DudeFilms | PixelDrain",
            title: `PixelDrain ${labelExtras}`,
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
      const fileName = $2("li.list-group-item:contains(Name)").text().replace(/Name\s*:\s*/i, "").trim() || $2("div.card-header").text() || "";
      const fileSize = $2("li.list-group-item:contains(Size)").text().replace(/Size\s*:\s*/i, "").trim() || "";
      const fileQuality = normalizeQuality(fileName);
      const streams = [];
      const btnPromises = [];
      $2("div.text-center a").each((_, el) => {
        const rawLink = $2(el).attr("href");
        const label = $2(el).text().toLowerCase();
        if (!rawLink)
          return;
        const link = absoluteUrl(targetUrl, rawLink);
        if (label.includes("direct dl")) {
          streams.push({
            name: "DudeFilms | GDFlix",
            title: `GD Direct [${fileSize}] - ${fileQuality}`,
            url: link,
            quality: fileQuality,
            headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": targetUrl, "Origin": getOrigin(targetUrl) })
          });
        } else if (label.includes("instant dl")) {
          btnPromises.push((() => __async(this, null, function* () {
            try {
              const instantRes = yield fetch(link, { headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": targetUrl }), redirect: "manual" });
              const loc = instantRes.headers.get("location") || "";
              const direct = loc.includes("url=") ? decodeURIComponent(loc.split("url=").pop()) : loc;
              if (!direct)
                return null;
              return {
                name: "DudeFilms | GDFlix Instant",
                title: `GD Instant [${fileSize}] - ${fileQuality}`,
                url: direct,
                quality: fileQuality,
                headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": targetUrl, "Origin": getOrigin(targetUrl) })
              };
            } catch (e) {
              return null;
            }
          }))());
        } else if (label.includes("index links")) {
          btnPromises.push(extractGDFlixIndexLinks(rawLink, fileSize, fileQuality));
        } else if (label.includes("drivebot")) {
          btnPromises.push(extractDriveBot(link, fileSize, fileQuality));
        } else if (label.includes("gofile")) {
          btnPromises.push(extractGofileFromWrapper(link));
        } else if (label.includes("pixeldrain") || label.includes("pixel")) {
          streams.push({ name: "DudeFilms | PixelDrain", title: `Pixel - ${fileQuality}`, url: link, quality: fileQuality, headers: HEADERS });
        }
      });
      ["type=1", "type=2"].forEach((t) => {
        btnPromises.push((() => __async(this, null, function* () {
          try {
            const cfBase = targetUrl.includes("/file/") ? targetUrl.replace("/file/", "/wfile/") : targetUrl.replace("file", "wfile");
            const cfUrl = cfBase + (targetUrl.includes("?") ? "&" : "?") + t;
            const cfRes = yield fetch(cfUrl, { headers: HEADERS });
            const cfHtml = yield cfRes.text();
            const cfLink = cheerio.load(cfHtml)("a.btn-success").attr("href");
            if (cfLink)
              return {
                name: "DudeFilms | GDFlix CF",
                title: `CF Backup ${t} [${fileSize}] - ${fileQuality}`,
                url: cfLink,
                quality: fileQuality,
                headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": targetUrl, "Origin": getOrigin(targetUrl) })
              };
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
function extractNestedHoster(u) {
  return __async(this, null, function* () {
    if (u.includes("hubcloud") || u.includes("shikshakdaak.com"))
      return yield extractHubCloud(u);
    if (u.includes("gdflix"))
      return yield extractGDFlix(u);
    if (u.includes("gofile.io"))
      return yield extractGofile(u);
    if (u.includes("hubdrive"))
      return yield extractHubdrive(u);
    if (u.includes("pixeldrain")) {
      const pxId = u.split("/").pop();
      return [{ name: "DudeFilms | PixelDrain", title: "PixelDrain Direct", url: `https://pixeldrain.com/api/file/${pxId}?download`, quality: "HD", headers: HEADERS }];
    }
    if (u.includes("hubcdn")) {
      try {
        const r = yield fetch(u, { headers: HEADERS });
        const h = yield r.text();
        const enc = h.match(/r=([A-Za-z0-9+/=]+)/) || h.match(/reurl\s*=\s*"[^"]*\?r=([A-Za-z0-9+/=]+)"/);
        if (enc) {
          const m3u8 = base64Decode(enc[1]).split("link=").pop();
          return [{ name: "DudeFilms | HubCDN", title: "Direct Stream", url: m3u8, quality: "720p", headers: { "Referer": u } }];
        }
      } catch (e) {
      }
    }
    return [];
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
      let bestScore = 0;
      $s("div.simple-grid-grid-post").each((_, el) => {
        const linkEl = $s(el).find("h3 a");
        const postTitle = linkEl.text();
        const href = linkEl.attr("href");
        const yearMatch = postTitle.match(/\((\d{4})\)/);
        const postYear = yearMatch ? yearMatch[1] : null;
        const score = calculateTitleSimilarity(title, postTitle, year, postYear);
        if (score > bestScore && score >= 0.8) {
          bestScore = score;
          postUrl = href;
        }
      });
      if (!postUrl)
        return [];
      const postRes = yield fetch(postUrl, { headers: HEADERS });
      const postHtml = yield postRes.text();
      const $p = cheerio.load(postHtml);
      const episodeUrls = [];
      if (mediaType === "tv") {
        const seasonRegex = new RegExp(`Season\\s*0*${season}`, "i");
        const epRegex = new RegExp(`(?:Episode|Ep|E)\\s*0*${episode}\\b`, "i");
        const seasonButtons = [];
        $p("h4").each((_, el) => {
          if (seasonRegex.test($p(el).text())) {
            let next = $p(el).next();
            while (next.length && (next.is("p") || next.is("div"))) {
              next.find("a.maxbutton").each((__, btn) => {
                const btnText = $p(btn).text().toLowerCase();
                if (!["torrent", "zip", "rar", "7z"].some((t) => btnText.includes(t))) {
                  const href = $p(btn).attr("href");
                  if (href)
                    seasonButtons.push(href);
                }
              });
              next = next.next();
            }
          }
        });
        if (seasonButtons.length === 0) {
          $p("a.maxbutton").each((_, el) => {
            const text = $p(el).text().toLowerCase();
            if (seasonRegex.test(text) && !["torrent", "zip", "rar", "7z"].some((t) => text.includes(t))) {
              const href = $p(el).attr("href");
              if (href)
                seasonButtons.push(href);
            }
          });
        }
        yield Promise.all([...new Set(seasonButtons)].map((sUrl) => __async(this, null, function* () {
          try {
            const sRes = yield fetch(sUrl, { headers: HEADERS });
            const sHtml = yield sRes.text();
            const $season = cheerio.load(sHtml);
            $season("a.maxbutton-ep, a.maxbutton").each((_, epBtn) => {
              const epText = $season(epBtn).text();
              if (epRegex.test(epText) || epText.trim() === episode.toString()) {
                const epUrl = $season(epBtn).attr("href");
                if (epUrl)
                  episodeUrls.push(epUrl);
              }
            });
          } catch (e) {
          }
        })));
      } else {
        $p("a.maxbutton").each((_, el) => {
          const href = $p(el).attr("href");
          const label = $p(el).text().toLowerCase();
          if (href && !["torrent", "rar", "zip", "7z"].some((t) => label.includes(t))) {
            episodeUrls.push(href);
          }
        });
      }
      if (episodeUrls.length === 0)
        return [];
      const finalStreams = (yield Promise.all([...new Set(episodeUrls)].map((u) => __async(this, null, function* () {
        const directResults = yield extractNestedHoster(u);
        if (directResults.length > 0)
          return directResults;
        try {
          const r = yield fetch(u, { headers: HEADERS });
          const h = yield r.text();
          const $d = cheerio.load(h);
          const subLinks = [];
          $d("a.maxbutton").each((__, el) => {
            const l = $d(el).attr("href");
            if (l && (l.includes("hubcloud") || l.includes("gdflix") || l.includes("gofile") || l.includes("hubdrive") || l.includes("hubcdn") || l.includes("pixeldrain")))
              subLinks.push(l);
          });
          if (subLinks.length > 0) {
            const results = yield Promise.all(subLinks.map((sl) => {
              return extractNestedHoster(sl);
            }));
            return results.flat();
          }
        } catch (e) {
        }
        return [];
      })))).flat().filter((s) => s && s.url);
      const unique = [];
      const seen = /* @__PURE__ */ new Set();
      finalStreams.forEach((s) => {
        if (!seen.has(s.url)) {
          seen.add(s.url);
          if (s.url.includes("m3u8"))
            s.isHLS = true;
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
