/**
 * animepahe - Built from src/animepahe/
 * Generated: 2026-05-01T04:20:01.633Z
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

// src/animepahe/index.js
var cheerio = require("cheerio-without-node-native");
var SERVER_DOMAINS = ["https://animepahe.org", "https://animepahe.com", "https://animepahe.pw"];
var PROXY = "https://animepaheproxy.phisheranimepahe.workers.dev/?url=";
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var TMDB_BASE = "https://api.themoviedb.org/3";
var currentBaseUrl = SERVER_DOMAINS[0];
var BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Referer": currentBaseUrl,
  "Cookie": "__ddg2_=1234567890"
};
function decryptPahe(fullString, key, v1, v2) {
  const keyIndexMap = {};
  for (let index = 0; index < key.length; index++) {
    keyIndexMap[key[index]] = index;
  }
  let result = "";
  let i = 0;
  const toFind = key[v2];
  while (i < fullString.length) {
    const nextIndex = fullString.indexOf(toFind, i);
    let decodedCharStr = "";
    for (let j = i; j < nextIndex; j++) {
      decodedCharStr += keyIndexMap[fullString[j]] !== void 0 ? keyIndexMap[fullString[j]] : -1;
    }
    i = nextIndex + 1;
    const decodedChar = String.fromCharCode(parseInt(decodedCharStr, v2) - v1);
    result += decodedChar;
  }
  return result;
}
function extractPaheStream(url) {
  return __async(this, null, function* () {
    try {
      console.log(`[AnimePahe] Starting Pahe extraction: ${url}`);
      const initialRes = yield fetch(`${url}/i`, { redirect: "manual" });
      const kwikUrl = initialRes.headers.get("location");
      if (!kwikUrl)
        throw new Error("Could not find kwik redirect location.");
      const playerRes = yield fetch(kwikUrl, { headers: { "Referer": "https://kwik.cx/" } });
      const playerHtml = yield playerRes.text();
      const setCookie = playerRes.headers.get("set-cookie");
      const kwikParamsRegex = /\("(\w+)",\d+,"(\w+)",(\d+),(\d+),\d+\)/;
      const match = playerHtml.match(kwikParamsRegex);
      if (!match)
        throw new Error("Could not find kwik decryption parameters.");
      const [_, fullString, key, v1, v2] = match;
      const decrypted = decryptPahe(fullString, key, parseInt(v1), parseInt(v2));
      const uriMatch = decrypted.match(/action="([^"]+)"/);
      const tokMatch = decrypted.match(/value="([^"]+)"/);
      if (!uriMatch || !tokMatch)
        throw new Error("Could not find POST URI or Token.");
      const postUri = uriMatch[1];
      const token = tokMatch[1];
      let tries = 0;
      let finalUrl = null;
      while (tries < 10) {
        const formData = new URLSearchParams();
        formData.append("_token", token);
        const postRes = yield fetch(postUri, {
          method: "POST",
          headers: __spreadProps(__spreadValues({}, BASE_HEADERS), {
            "Referer": kwikUrl,
            "Cookie": setCookie || ""
          }),
          body: formData,
          redirect: "manual"
        });
        if (postRes.status === 302) {
          finalUrl = postRes.headers.get("location");
          break;
        }
        tries++;
      }
      return finalUrl;
    } catch (e) {
      console.error(`[AnimePahe] Pahe Extractor Error: ${e.message}`);
      return null;
    }
  });
}
function extractKwikDirect(url) {
  return __async(this, null, function* () {
    try {
      const res = yield fetch(url, { headers: { "Referer": url } });
      const html = yield res.text();
      const scriptMatch = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\}\(([\s\S]*?)\)\)/);
      if (!scriptMatch)
        return null;
      const m3u8Match = html.match(/source\s*=\s*'([^']*\.m3u8[^']*)'/);
      if (m3u8Match)
        return m3u8Match[1];
      return null;
    } catch (e) {
      return null;
    }
  });
}
function fetchAniZip(malId) {
  return __async(this, null, function* () {
    if (!malId)
      return null;
    try {
      const res = yield fetch(`https://api.ani.zip/mappings?mal_id=${malId}`);
      if (!res.ok)
        return null;
      return yield res.json();
    } catch (e) {
      return null;
    }
  });
}
function getTMDBInfo(id, type) {
  return __async(this, null, function* () {
    try {
      const url = `${TMDB_BASE}/${type === "movie" ? "movie" : "tv"}/${id}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
      const res = yield fetch(url);
      return yield res.json();
    } catch (e) {
      return null;
    }
  });
}
function getStreams(tmdbId, mediaType = "tv", season = 1, episode = 1) {
  return __async(this, null, function* () {
    var _a, _b, _c;
    try {
      console.log(`[AnimePahe] Upgraded Request: ID=${tmdbId}, S=${season}, E=${episode}`);
      let tmdbData;
      const isNumericId = /^\d+$/.test(tmdbId);
      if (isNumericId) {
        tmdbData = yield getTMDBInfo(tmdbId, mediaType);
      }
      if (!tmdbData) {
        console.log("[AnimePahe] TMDB resolution skipped or failed. Using fallback.");
        tmdbData = {
          name: tmdbId,
          title: tmdbId,
          first_air_date: null,
          original_language: "ja",
          genres: [{ id: 16 }]
          // Force pass validation
        };
      }
      const isAnimation = (tmdbData.genres || []).some((g) => g.id === 16);
      if (!isAnimation || tmdbData.original_language !== "ja") {
        console.log("[AnimePahe] Content is not Japanese Animation. Skipping.");
        return [];
      }
      const malId = (_a = tmdbData.external_ids) == null ? void 0 : _a.mal_id;
      const aniZip = yield fetchAniZip(malId);
      const searchTitle = tmdbData.name || tmdbData.title;
      const searchUrl = `${PROXY}${encodeURIComponent(currentBaseUrl + "/api?m=search&l=8&q=" + encodeURIComponent(searchTitle))}`;
      const searchRes = yield fetch(searchUrl, { headers: BASE_HEADERS });
      const searchData = yield searchRes.json();
      if (!searchData.data || searchData.data.length === 0) {
        console.log("[AnimePahe] No search results.");
        return [];
      }
      const hits = searchData.data.map((hit) => __spreadProps(__spreadValues({}, hit), {
        score: calculateMatchScore(hit, searchTitle, season, tmdbData.first_air_date)
      })).sort((a, b) => b.score - a.score);
      const bestMatch = hits[0].score > 50 ? hits[0] : null;
      if (!bestMatch) {
        console.log("[AnimePahe] No reliable match found.");
        return [];
      }
      console.log(`[AnimePahe] Matched: ${bestMatch.title} (Score: ${bestMatch.score})`);
      const epUrl = `${PROXY}${encodeURIComponent(currentBaseUrl + `/api?m=release&id=${bestMatch.session}&sort=episode_asc&page=1`)}`;
      const epRes = yield fetch(epUrl, { headers: BASE_HEADERS });
      const epData = yield epRes.json();
      let allEpisodes = epData.data || [];
      if (epData.last_page > 1) {
        const extraPages = yield Promise.all(
          Array.from(
            { length: epData.last_page - 1 },
            (_, i) => fetch(`${PROXY}${encodeURIComponent(currentBaseUrl + `/api?m=release&id=${bestMatch.session}&sort=episode_asc&page=${i + 2}`)}`, { headers: BASE_HEADERS }).then((r) => r.json()).then((d) => d.data || [])
          )
        );
        allEpisodes = allEpisodes.concat(...extraPages);
      }
      const targetEp = allEpisodes.find((ep) => parseInt(ep.episode) === parseInt(episode));
      if (!targetEp) {
        console.log(`[AnimePahe] Episode ${episode} not found.`);
        return [];
      }
      const playUrl = `${PROXY}${encodeURIComponent(currentBaseUrl + `/play/${bestMatch.session}/${targetEp.session}`)}`;
      const playRes = yield fetch(playUrl, { headers: BASE_HEADERS });
      const playHtml = yield playRes.text();
      const $ = cheerio.load(playHtml);
      const streamPromises = [];
      $("#resolutionMenu button").each((_, btn) => {
        var _a2;
        const kwikLink = $(btn).attr("data-src");
        const btnText = $(btn).text();
        const quality = ((_a2 = btnText.match(/(\d{3,4})p/)) == null ? void 0 : _a2[1]) || "720";
        const isDub = btnText.toLowerCase().includes("eng");
        if (kwikLink) {
          streamPromises.push(processLink(kwikLink, quality, isDub ? "Dub" : "Sub"));
        }
      });
      $("#pickDownload a").each((_, a) => {
        var _a2;
        const paheLink = $(a).attr("href");
        const aText = $(a).text();
        const quality = ((_a2 = aText.match(/(\d{3,4})p/)) == null ? void 0 : _a2[1]) || "720";
        const isDub = aText.toLowerCase().includes("eng");
        if (paheLink) {
          streamPromises.push(processLink(paheLink, quality, isDub ? "Dub" : "Sub"));
        }
      });
      const streams = (yield Promise.all(streamPromises)).flat().filter(Boolean);
      const epMeta = (_b = aniZip == null ? void 0 : aniZip.episodes) == null ? void 0 : _b[episode];
      const finalTitle = ((_c = epMeta == null ? void 0 : epMeta.title) == null ? void 0 : _c.en) || targetEp.title || `Episode ${episode}`;
      return streams.map((s) => __spreadProps(__spreadValues({}, s), {
        title: `${finalTitle}
\u{1F4CC} ${s.quality} \xB7 ${s.type === "hls" ? "HLS" : "MP4"}
by Kabir \xB7 Master Port`,
        subtitles: aniZip ? parseAniZipSubs(aniZip) : []
      }));
    } catch (e) {
      console.error(`[AnimePahe] Global Error: ${e.message}`);
      return [];
    }
  });
}
function processLink(url, quality, type) {
  return __async(this, null, function* () {
    if (url.includes("pahe.win")) {
      const direct = yield extractPaheStream(url);
      if (direct)
        return {
          name: `\u{1F4A1} Pahe | ${quality}p [${type}]`,
          url: direct,
          quality: quality + "p",
          type: "mp4"
        };
    } else if (url.includes("kwik.cx")) {
      const direct = yield extractKwikDirect(url);
      if (direct)
        return {
          name: `\u{1F680} Kwik | ${quality}p [${type}]`,
          url: direct,
          quality: quality + "p",
          type: "hls",
          headers: { "Referer": "https://kwik.cx/" }
        };
    }
    return null;
  });
}
function calculateMatchScore(hit, query, season, airDate) {
  const h = hit.title.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  if (h === q)
    score += 100;
  if (h.includes(q))
    score += 40;
  if (airDate && h.includes(airDate.split("-")[0]))
    score += 20;
  if (season > 1 && h.includes(`season ${season}`))
    score += 30;
  if (season === 1 && (h.includes("season 2") || h.includes("season 3")))
    score -= 50;
  return score;
}
function parseAniZipSubs(aniZip) {
  return [];
}
module.exports = { getStreams };
if (typeof global !== "undefined") {
  global.getStreams = getStreams;
}
