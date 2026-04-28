/**
 * allwish - Built from src/allwish/
 * Generated: 2026-04-28T07:53:11.812Z
 */
var __defProp = Object.defineProperty;
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

// src/allwish/index.js
var cheerio = require("cheerio-without-node-native");
var TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var MAIN_URL = "https://all-wish.me";
var AJAX_HEADERS = {
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0"
};
function fetchText(url, options = {}) {
  return fetch(url, __spreadValues({
    headers: __spreadValues({
      "User-Agent": "Mozilla/5.0"
    }, options.headers || {})
  }, options)).then((res) => {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return res.text();
  });
}
function fetchJson(url, options = {}) {
  return fetchText(url, options).then(JSON.parse);
}
function normalizeText(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(tv|dub|sub|subbed|dubbed|season|part|movie|specials?)\b/g, " ").replace(/\s+/g, " ").trim();
}
function ordinalSeasonLabel(season) {
  const n = Number(season);
  if (!Number.isFinite(n))
    return "";
  if (n === 1)
    return "1st";
  if (n === 2)
    return "2nd";
  if (n === 3)
    return "3rd";
  return `${n}th`;
}
function tokenize(text) {
  return normalizeText(text).split(" ").filter(Boolean);
}
function scoreTitleMatch(candidate, query) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length)
    return 0;
  const candidateTokens = new Set(tokenize(candidate));
  let score = 0;
  queryTokens.forEach((token) => {
    if (candidateTokens.has(token))
      score += 10;
  });
  const normalizedCandidate = normalizeText(candidate);
  const normalizedQuery = normalizeText(query);
  if (normalizedCandidate.includes(normalizedQuery))
    score += 20;
  if (normalizedCandidate === normalizedQuery)
    score += 100;
  if (/\bspecials?\b/i.test(candidate))
    score -= 40;
  if (/\breawakening\b/i.test(candidate))
    score -= 30;
  if (/\bseason\s*2\b/i.test(candidate))
    score -= 25;
  return score;
}
function getTmdbDetails(tmdbId, mediaType) {
  const type = mediaType === "movie" ? "movie" : "tv";
  const url = `${TMDB_BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
  return fetchJson(url).then((data) => {
    var _a, _b;
    return {
      title: mediaType === "movie" ? data.title : data.name,
      originalTitle: mediaType === "movie" ? data.original_title : data.original_name,
      year: ((_b = (_a = mediaType === "movie" ? data.release_date : data.first_air_date) == null ? void 0 : _a.split("-")) == null ? void 0 : _b[0]) || null,
      genres: (data.genres || []).map((g) => g.id),
      originalLanguage: data.original_language
    };
  });
}
function getTmdbSeasonDetails(tmdbId, season) {
  if (!tmdbId || !season || Number(season) < 1)
    return Promise.resolve(null);
  const url = `${TMDB_BASE_URL}/tv/${tmdbId}/season/${season}?api_key=${TMDB_API_KEY}`;
  return fetchJson(url).then((data) => ({
    name: data.name || "",
    seasonNumber: data.season_number || season
  })).catch(() => null);
}
function isStrictAnimeTmdbEntry(mediaInfo) {
  const genres = Array.isArray(mediaInfo == null ? void 0 : mediaInfo.genres) ? mediaInfo.genres : [];
  const isAnimation = genres.includes(16);
  const isJapanese = (mediaInfo == null ? void 0 : mediaInfo.originalLanguage) === "ja";
  return isAnimation && isJapanese;
}
function buildSeasonQueries(mediaInfo, season, seasonInfo) {
  const queries = [mediaInfo.title, mediaInfo.originalTitle];
  if (season > 1) {
    queries.push(`${mediaInfo.title} Season ${season}`);
    queries.push(`${mediaInfo.title} ${ordinalSeasonLabel(season)} Season`);
    queries.push(`${mediaInfo.originalTitle} Season ${season}`);
    if (seasonInfo == null ? void 0 : seasonInfo.name)
      queries.push(seasonInfo.name);
  }
  return queries.filter((value, index, arr) => value && arr.indexOf(value) === index);
}
function scoreAllWishCandidate(candidate, query, season) {
  let score = scoreTitleMatch(candidate.title, query);
  if (season > 1) {
    const seasonRegex = new RegExp(`\\b(${season}|${ordinalSeasonLabel(season)})\\b`, "i");
    if (seasonRegex.test(candidate.title) || seasonRegex.test(candidate.watchUrl))
      score += 50;
    if (!seasonRegex.test(candidate.title) && /season|part/i.test(candidate.title))
      score -= 30;
  }
  return score;
}
function searchAllWish(mediaInfo, season = 1, seasonInfo = null) {
  const queries = buildSeasonQueries(mediaInfo, season, seasonInfo);
  return queries.reduce((promise, query) => promise.then((best) => {
    const url = `${MAIN_URL}/filter?keyword=${encodeURIComponent(query)}&page=1`;
    return fetchText(url).then((html) => {
      const $ = cheerio.load(html);
      const matches = $("div.item").map((_, el) => {
        const title = $(el).find("div.name > a").text().trim();
        const href = $(el).find("div.name > a").attr("href");
        if (!title || !href)
          return null;
        const watchUrl = href.replace(/\/ep-\d+\/?$/i, "");
        return {
          title,
          watchUrl,
          score: scoreAllWishCandidate({ title, watchUrl }, query, season)
        };
      }).get().filter(Boolean).sort((a, b) => b.score - a.score);
      const top = matches[0] || null;
      if (!top)
        return best;
      if (!best || top.score > best.score)
        return top;
      return best;
    }).catch(() => best);
  }), Promise.resolve(null));
}
function generateEpisodeVrf(episodeId) {
  const secretKey = "ysJhV6U27FVIjjuk";
  const encodedId = encodeURIComponent(episodeId).replace(/%21/g, "!").replace(/%27/g, "'").replace(/%28/g, "(").replace(/%29/g, ")").replace(/%7E/g, "~").replace(/%2A/g, "*");
  const keyCodes = Array.from(secretKey).map((ch) => ch.charCodeAt(0));
  const dataCodes = Array.from(encodedId).map((ch) => ch.charCodeAt(0));
  const n = Array.from({ length: 256 }, (_, i) => i);
  let a = 0;
  for (let o2 = 0; o2 <= 255; o2 += 1) {
    a = (a + n[o2] + keyCodes[o2 % keyCodes.length]) % 256;
    [n[o2], n[a]] = [n[a], n[o2]];
  }
  const out = [];
  let o = 0;
  a = 0;
  for (let r = 0; r < dataCodes.length; r += 1) {
    o = (o + 1) % 256;
    a = (a + n[o]) % 256;
    [n[o], n[a]] = [n[a], n[o]];
    const k = n[(n[o] + n[a]) % 256];
    out.push((dataCodes[r] ^ k) & 255);
  }
  const bytesToBase64Url = (bytes) => {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
  };
  const latin1StringToBytes = (value) => {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      bytes[i] = value.charCodeAt(i) & 255;
    }
    return bytes;
  };
  const base1 = bytesToBase64Url(out);
  const step2 = latin1StringToBytes(base1).map((value, index) => {
    let s = value;
    s += { 1: 3, 7: 5, 2: -4, 4: -2, 6: 4, 0: -3, 3: 2, 5: 5 }[index % 8] || 0;
    return s & 255;
  });
  const base2 = bytesToBase64Url(step2);
  return Array.from(base2).map((char) => {
    if (char >= "A" && char <= "Z")
      return String.fromCharCode((char.charCodeAt(0) - 65 + 13) % 26 + 65);
    if (char >= "a" && char <= "z")
      return String.fromCharCode((char.charCodeAt(0) - 97 + 13) % 26 + 97);
    return char;
  }).join("");
}
function chooseEpisode($, mediaType, episode) {
  const entries = $("div.range > div > a").map((_, el) => ({
    slug: parseInt($(el).attr("data-slug") || "0", 10),
    ids: $(el).attr("data-ids") || "",
    hasSub: $(el).attr("data-sub") === "1",
    hasDub: $(el).attr("data-dub") === "1"
  })).get().filter((item) => item.ids);
  if (!entries.length)
    return null;
  if (mediaType === "movie" || episode == null)
    return entries[0];
  return entries.find((item) => item.slug === Number(episode)) || null;
}
function decodeUnicodeEscapes(value) {
  return String(value || "").replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
function extractScriptData(html) {
  var _a, _b, _c, _d;
  const script = cheerio.load(html)("script[type=module]").html() || "";
  const videoB64 = (_a = script.match(/video_b64:\s*"([^"]+)"/)) == null ? void 0 : _a[1];
  const keyB64 = (_b = script.match(/enc_key_b64:\s*"([^"]+)"/)) == null ? void 0 : _b[1];
  const ivB64 = (_c = script.match(/iv_b64:\s*"([^"]+)"/)) == null ? void 0 : _c[1];
  const subtitlesRaw = (_d = script.match(/subtitles:\s*"([^"]*)"/)) == null ? void 0 : _d[1];
  return { videoB64, keyB64, ivB64, subtitlesRaw };
}
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
function pkcs7Unpad(buffer) {
  const pad = buffer[buffer.length - 1];
  return buffer.subarray(0, buffer.length - pad);
}
function decryptAesCbc(videoB64, keyB64, ivB64) {
  return __async(this, null, function* () {
    var _a;
    if (!((_a = globalThis.crypto) == null ? void 0 : _a.subtle) || typeof TextDecoder === "undefined") {
      throw new Error("WebCrypto unavailable");
    }
    const key = yield globalThis.crypto.subtle.importKey(
      "raw",
      base64ToBytes(keyB64),
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );
    const decrypted = yield globalThis.crypto.subtle.decrypt(
      { name: "AES-CBC", iv: base64ToBytes(ivB64) },
      key,
      base64ToBytes(videoB64)
    );
    return new TextDecoder().decode(pkcs7Unpad(new Uint8Array(decrypted)));
  });
}
function parseZenSubtitles(subtitlesRaw) {
  if (!subtitlesRaw)
    return [];
  try {
    const jsonString = decodeUnicodeEscapes(subtitlesRaw).replace(/\\"/g, '"').replace(/\\\\\//g, "/");
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed.map((item) => ({ label: item.language || "Unknown", url: item.url })).filter((item) => item.url) : [];
  } catch (_) {
    return [];
  }
}
function extractMegaPlay(url, streamLabel) {
  return __async(this, null, function* () {
    var _a;
    const playerHeaders = {
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://megaplay.buzz"
    };
    const pageHtml = yield fetchText(url, { headers: playerHeaders });
    const $ = cheerio.load(pageHtml);
    const id = $("#megaplay-player").attr("data-id");
    if (!id)
      return [];
    const sourceJson = yield fetchJson(`https://megaplay.buzz/stream/getSources?id=${id}&id=${id}`, { headers: playerHeaders });
    const file = (_a = sourceJson == null ? void 0 : sourceJson.sources) == null ? void 0 : _a.file;
    if (!file)
      return [];
    const subtitles = (sourceJson.tracks || []).filter((track) => track.kind === "captions" || track.kind === "subtitles").map((track) => ({ label: track.label, url: track.file })).filter((track) => track.url);
    return [{
      name: `AllWish ${streamLabel} MegaPlay`,
      title: streamLabel,
      url: file,
      quality: "Unknown",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) rv:140.0) Gecko/20100101 Firefox/140.0",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        Origin: "https://megaplay.buzz",
        Referer: "https://megaplay.buzz/",
        Connection: "keep-alive",
        Pragma: "no-cache",
        "Cache-Control": "no-cache"
      },
      subtitles,
      provider: "AllWish"
    }];
  });
}
function extractZen(url, streamLabel) {
  return __async(this, null, function* () {
    const pageHtml = yield fetchText(url);
    const { videoB64, keyB64, ivB64, subtitlesRaw } = extractScriptData(pageHtml);
    if (!videoB64 || !keyB64 || !ivB64)
      return [];
    const decryptedUrl = yield decryptAesCbc(videoB64, keyB64, ivB64).catch(() => null);
    if (!decryptedUrl)
      return [];
    return [{
      name: `AllWish ${streamLabel} Zen`,
      title: streamLabel,
      url: decryptedUrl.trim(),
      quality: "1080p",
      headers: {
        Referer: "https://player.sgsgsgsr.site/",
        Origin: "https://player.sgsgsgsr.site/",
        "User-Agent": "Mozilla/5.0"
      },
      subtitles: parseZenSubtitles(subtitlesRaw),
      provider: "AllWish"
    }];
  });
}
function uniqueStreams(streams) {
  const seen = /* @__PURE__ */ new Set();
  return streams.filter((stream) => {
    const key = `${stream.name}|${stream.url}`;
    if (!stream.url || seen.has(key))
      return false;
    seen.add(key);
    return true;
  });
}
function resolveServerLinks(ids, allowedTypes) {
  return __async(this, null, function* () {
    var _a;
    const serverList = yield fetchJson(`${MAIN_URL}/ajax/server/list?servers=${encodeURIComponent(ids)}`, {
      headers: AJAX_HEADERS
    }).catch(() => null);
    if ((serverList == null ? void 0 : serverList.status) !== 200)
      return [];
    const $ = cheerio.load(serverList.result || "");
    const sections = $("div.server-type").toArray();
    const resolved = [];
    for (const section of sections) {
      const sectionType = $(section).attr("data-type");
      const isHardSub = ($(section).find("span").first().text() || "").includes("H-Sub");
      if (!allowedTypes.includes(sectionType))
        continue;
      const servers = $(section).find("div.server-list > div.server").toArray();
      for (const server of servers) {
        const dataId = $(server).attr("data-link-id");
        const serverName = $(server).text().trim();
        if (!dataId)
          continue;
        const apiRes = yield fetchJson(`${MAIN_URL}/ajax/server?get=${encodeURIComponent(dataId)}`, {
          headers: AJAX_HEADERS
        }).catch(() => null);
        const realUrl = (_a = apiRes == null ? void 0 : apiRes.result) == null ? void 0 : _a.url;
        if (!realUrl)
          continue;
        const streamLabel = sectionType === "dub" ? "[Dub]" : isHardSub ? "[Hard Sub]" : "[Sub]";
        if (/megaplay\.buzz/i.test(realUrl)) {
          resolved.push(...yield extractMegaPlay(realUrl, streamLabel).catch(() => []));
        } else if (/player\.sgsgsgsr\.site|zencloudz\.cc/i.test(realUrl) || /ZEN/i.test(serverName)) {
          resolved.push(...yield extractZen(realUrl, streamLabel).catch(() => []));
        }
      }
    }
    return uniqueStreams(resolved);
  });
}
function getStreams(tmdbId, mediaType = "tv", season = null, episode = null) {
  return __async(this, null, function* () {
    console.log(`[AllWish] Fetching ${mediaType} tmdbId=${tmdbId} season=${season} episode=${episode}`);
    if (mediaType !== "tv" && mediaType !== "movie")
      return [];
    try {
      const mediaInfo = yield getTmdbDetails(tmdbId, mediaType);
      if (!(mediaInfo == null ? void 0 : mediaInfo.title))
        return [];
      if (!isStrictAnimeTmdbEntry(mediaInfo)) {
        console.log(`[AllWish] Content is NOT Japanese Animation (Genres: ${mediaInfo.genres}, Lang: ${mediaInfo.originalLanguage}). Rejecting.`);
        return [];
      }
      const seasonInfo = mediaType === "tv" ? yield getTmdbSeasonDetails(tmdbId, season) : null;
      const match = yield searchAllWish(mediaInfo, season || 1, seasonInfo);
      if (!(match == null ? void 0 : match.watchUrl))
        return [];
      const detailHtml = yield fetchText(match.watchUrl);
      const $detail = cheerio.load(detailHtml);
      const showId = $detail("main > div.container").attr("data-id");
      if (!showId)
        return [];
      const vrf = generateEpisodeVrf(showId);
      const episodeList = yield fetchJson(`${MAIN_URL}/ajax/episode/list/${showId}?vrf=${encodeURIComponent(vrf)}`, {
        headers: AJAX_HEADERS
      }).catch(() => null);
      if ((episodeList == null ? void 0 : episodeList.status) !== 200)
        return [];
      const $episodes = cheerio.load(episodeList.result || "");
      const selectedEpisode = chooseEpisode($episodes, mediaType, episode);
      if (!selectedEpisode)
        return [];
      const allowedTypes = [];
      if (selectedEpisode.hasSub)
        allowedTypes.push("sub");
      if (selectedEpisode.hasDub)
        allowedTypes.push("dub");
      if (!allowedTypes.length)
        return [];
      return resolveServerLinks(selectedEpisode.ids, allowedTypes);
    } catch (error) {
      console.error(`[AllWish] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
