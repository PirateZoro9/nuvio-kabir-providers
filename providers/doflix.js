/**
 * doflix - Built from src/doflix/
 * Generated: 2026-04-28T05:06:49.319Z
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

// src/doflix/index.js
var cheerio = require("cheerio-without-node-native");
var MAIN_URL = "https://panel.watchkaroabhi.com";
var API_KEY = "qNhKLJiZVyoKdi9NCQGz8CIGrpUijujE";
var HEADERS = {
  "Connection": "Keep-Alive",
  "User-Agent": "dooflix",
  "X-App-Version": "305",
  "X-Package-Name": "com.king.moja",
  "Accept": "application/json"
};
var STREAM_HEADERS = {
  "Referer": "https://molop.art/",
  "User-Agent": "dooflix"
};
function request(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    try {
      const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
        headers: __spreadValues(__spreadValues({}, HEADERS), options.headers)
      }));
      if (!response.ok)
        throw new Error(`API Error: ${response.status}`);
      return yield response.json();
    } catch (e) {
      throw e;
    }
  });
}
function normalizeQuality(q) {
  if (!q)
    return "720p";
  const quality = q.toUpperCase();
  if (quality.includes("4K") || quality.includes("2160"))
    return "2160p";
  if (quality.includes("FHD") || quality.includes("1080"))
    return "1080p";
  if (quality.includes("HD") || quality.includes("720"))
    return "720p";
  if (quality.includes("SD") || quality.includes("480"))
    return "480p";
  return "720p";
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[DoFlix] Request: ${mediaType} ${tmdbId}`);
      let linksUrl = "";
      if (mediaType === "movie") {
        linksUrl = `${MAIN_URL}/api/3/movie/${tmdbId}/links?api_key=${API_KEY}`;
      } else {
        linksUrl = `${MAIN_URL}/api/3/tv/${tmdbId}/season/${season}/episode/${episode}/links?api_key=${API_KEY}`;
      }
      const data = yield request(linksUrl);
      const linksArray = mediaType === "movie" ? data.links : data.results;
      if (!linksArray || !Array.isArray(linksArray))
        return [];
      const streams = linksArray.map((link) => {
        if (!link.url)
          return null;
        const quality = normalizeQuality(link.quality);
        const host = link.host || "DoFlix";
        const finalUrl = link.url.includes(".m3u8") ? link.url : `${link.url}#.m3u8`;
        return {
          name: `DoFlix | ${host}`,
          title: `${host} - ${quality}`,
          url: finalUrl,
          quality,
          headers: STREAM_HEADERS
        };
      }).filter(Boolean);
      return streams;
    } catch (e) {
      console.error(`[DoFlix] Stream Error: ${e.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
if (typeof global !== "undefined") {
  global.getStreams = getStreams;
}
