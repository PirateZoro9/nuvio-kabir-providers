/**
 * sflix - Built from src/sflix/
 * Generated: 2026-04-30T08:48:04.827Z
 */
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

// src/sflix/index.js
var cheerio = require("cheerio-without-node-native");
var BASE_URL = "https://sflix.film";
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var TMDB_BASE = "https://api.themoviedb.org/3";
var PROXY_URL = "https://script.google.com/macros/s/AKfycbxqpHMie9RFfevHFuUZRGiQqidN5iugORvxksVbZt8TEOYjiPylRtZVX50VFnlUMkr7VA/exec";
function bffRequest(_0) {
  return __async(this, arguments, function* (action, params = {}) {
    try {
      let queryParts = [`action=${action}`];
      for (let key in params) {
        queryParts.push(`${key}=${encodeURIComponent(params[key])}`);
      }
      const proxyUrl = `${PROXY_URL}?${queryParts.join("&")}`;
      const response = yield fetch(proxyUrl);
      if (!response.ok)
        throw new Error(`Proxy Request Failed: ${response.status}`);
      const json = yield response.json();
      if (json.code !== 0)
        throw new Error(`BFF Logic Error: ${json.message || "Unknown error"}`);
      return json.data;
    } catch (e) {
      console.error(`[SFlix Proxy] Error: ${e.message}`);
      throw e;
    }
  });
}
function getTMDBInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a;
    const type = mediaType === "movie" ? "movie" : "tv";
    const url = `${TMDB_BASE}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = yield fetch(url);
    const data = yield res.json();
    return {
      title: mediaType === "movie" ? data.title : data.name,
      originalTitle: mediaType === "movie" ? data.original_title : data.original_name,
      year: ((_a = mediaType === "movie" ? data.release_date : data.first_air_date) == null ? void 0 : _a.split("-")[0]) || ""
    };
  });
}
function formatQuality(res) {
  if (!res)
    return "Auto";
  const str = String(res);
  return str.endsWith("p") ? str : str + "p";
}
function uniqueStreams(streams) {
  const seen = /* @__PURE__ */ new Set();
  return streams.filter((s) => {
    if (!s.url || seen.has(s.url))
      return false;
    seen.add(s.url);
    return true;
  });
}
function searchSFlix(query) {
  return __async(this, null, function* () {
    const data = yield bffRequest("sflix_search", { q: query });
    return (data == null ? void 0 : data.items) || [];
  });
}
function loadDetail(subjectId) {
  return __async(this, null, function* () {
    const data = yield bffRequest("sflix_detail", { id: subjectId });
    if (!(data == null ? void 0 : data.subject))
      throw new Error("Metadata not found");
    const subject = data.subject;
    const resource = data.resource;
    const episodes = [];
    const isSeries = subject.subjectType === 2;
    if (isSeries && (resource == null ? void 0 : resource.seasons)) {
      resource.seasons.forEach((season) => {
        const epNums = season.allEp ? season.allEp.split(",").map(Number) : Array.from({ length: season.maxEp }, (_, i) => i + 1);
        epNums.forEach((num) => {
          episodes.push({
            name: `Episode ${num}`,
            season: season.se,
            episode: num,
            id: subject.subjectId,
            path: subject.detailPath
          });
        });
      });
    } else {
      episodes.push({
        name: "Movie",
        season: 0,
        episode: 0,
        id: subject.subjectId,
        path: subject.detailPath
      });
    }
    return { subject, episodes };
  });
}
function fetchSubtitles(streamId, format, subjectId, path) {
  return __async(this, null, function* () {
    try {
      const refererUrl = `${BASE_URL}/spa/videoPlayPage/movies/${path}?id=${subjectId}&type=/movie/detail&lang=en`;
      const data = yield bffRequest("sflix_caption", {
        format,
        id: streamId,
        sid: subjectId,
        referer: refererUrl
      });
      if (data == null ? void 0 : data.captions) {
        return data.captions.map((sub) => ({
          url: sub.url,
          label: sub.lanName || sub.lan || "Unknown",
          lang: sub.lanName || sub.lan || "Unknown"
        })).filter((sub) => sub.url);
      }
    } catch (e) {
    }
    return [];
  });
}
function resolvePlayInfo(id, se, ep, path) {
  return __async(this, null, function* () {
    const refererUrl = `${BASE_URL}/spa/videoPlayPage/movies/${path}?id=${id}&type=/movie/detail&lang=en`;
    const data = yield bffRequest("sflix_play", {
      id,
      se,
      ep,
      referer: refererUrl
    });
    if (!(data == null ? void 0 : data.streams) || data.streams.length === 0)
      return [];
    const subtitles = yield fetchSubtitles(data.streams[0].id, data.streams[0].format, id, path);
    const streamResults = data.streams.reverse().map((s) => ({
      name: "SFlix (Global)",
      title: `SFlix - ${formatQuality(s.resolutions)}`,
      url: s.url,
      quality: formatQuality(s.resolutions),
      headers: { "Referer": `${BASE_URL}/` },
      subtitles
    }));
    return uniqueStreams(streamResults);
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a;
    try {
      console.log(`[SFlix] Request: ${mediaType} ${tmdbId} S:${season} E:${episode}`);
      const info = yield getTMDBInfo(tmdbId, mediaType);
      if (!info.title)
        return [];
      const targetTitle = info.title.toLowerCase();
      const originalTitle = ((_a = info.originalTitle) == null ? void 0 : _a.toLowerCase()) || "";
      const targetYear = info.year;
      const searchResults = yield searchSFlix(info.title);
      const match = searchResults.find((r) => {
        var _a2;
        const rTitle = r.title.toLowerCase();
        const rYear = ((_a2 = r.releaseDate) == null ? void 0 : _a2.split("-")[0]) || "";
        const isTitleMatch = rTitle === targetTitle || rTitle === originalTitle || rTitle.includes(targetTitle);
        const isYearMatch = rYear === targetYear;
        return isTitleMatch && (isYearMatch || Math.abs(parseInt(rYear) - parseInt(targetYear)) <= 1);
      });
      if (!match) {
        console.warn(`[SFlix] No strict match found for ${info.title} (${info.year})`);
        return [];
      }
      const detail = yield loadDetail(match.subjectId);
      let target = null;
      if (mediaType === "movie") {
        target = detail.episodes[0];
      } else {
        target = detail.episodes.find((e) => e.season == season && e.episode == episode);
      }
      if (!target)
        return [];
      return yield resolvePlayInfo(target.id, target.season, target.episode, target.path);
    } catch (error) {
      console.error(`[SFlix] Fatal Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
