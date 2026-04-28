/**
 * streamflix - Built from src/streamflix/
 * Generated: 2026-04-28T05:06:49.358Z
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

// src/streamflix/index.js
var cheerio = require("cheerio-without-node-native");
var MAIN_URL = "https://api.streamflix.app";
var WS_URL = "wss://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/.ws?ns=chilflix-410be-default-rtdb&v=5";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://api.streamflix.app"
};
var cachedConfig = null;
function findItemInDatabase(tmdbId, title) {
  return __async(this, null, function* () {
    try {
      console.log("[StreamFlix] Surgical database search...");
      const res = yield fetch(`${MAIN_URL}/data.json`, { headers: HEADERS });
      const text = yield res.text();
      if (!text)
        return null;
      let block = null;
      if (tmdbId) {
        const tmdbRegex = new RegExp(`{[^{}]*"tmdb"\\s*:\\s*"${tmdbId}"[^{}]*}`, "i");
        const match = text.match(tmdbRegex);
        if (match)
          block = match[0];
      }
      if (!block && title) {
        const titleRegex = new RegExp(`{[^{}]*"moviename"\\s*:\\s*"${title}"[^{}]*}`, "i");
        const match = text.match(titleRegex);
        if (match)
          block = match[0];
      }
      if (block) {
        const item = JSON.parse(block);
        return {
          n: item.moviename.toLowerCase(),
          k: item.moviekey,
          t: item.tmdb,
          i: item.movieimdb,
          l: item.movielink,
          isTV: !!item.isTV
        };
      }
    } catch (e) {
      console.error(`[StreamFlix] Database lookup failed: ${e.message}`);
    }
    return null;
  });
}
function getConfig() {
  return __async(this, null, function* () {
    if (cachedConfig)
      return cachedConfig;
    try {
      const res = yield fetch(`${MAIN_URL}/config/config-streamflixapp.json`, { headers: HEADERS });
      const text = yield res.text();
      cachedConfig = JSON.parse(text);
      return cachedConfig;
    } catch (e) {
      return { premium: [], movies: [], tv: [] };
    }
  });
}
function getEpisodesFromWS(movieKey, targetSeason) {
  return __async(this, null, function* () {
    if (typeof WebSocket === "undefined")
      return {};
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);
      const seasonsData = {};
      let isResolved = false;
      let messageBuffer = "";
      ws.onopen = () => {
        ws.send(JSON.stringify({
          t: "d",
          d: { a: "q", r: 1, b: { p: `Data/${movieKey}/seasons/${targetSeason}/episodes`, h: "" } }
        }));
      };
      ws.onmessage = (event) => {
        if (isResolved)
          return;
        messageBuffer += event.data;
        try {
          if (!messageBuffer.trim().startsWith("{") && !/^\d+$/.test(messageBuffer.trim())) {
            return;
          }
          const json = JSON.parse(messageBuffer);
          messageBuffer = "";
          if (json.t === "d" && json.d && json.d.b) {
            const b = json.d.b;
            if (b.s === "ok" || b.d) {
              if (b.d) {
                seasonsData[targetSeason] = b.d;
              }
              isResolved = true;
              ws.close();
              resolve(seasonsData);
            }
          }
        } catch (e) {
          if (messageBuffer.length > 5e5)
            messageBuffer = "";
        }
      };
      ws.onerror = () => {
        isResolved = true;
        resolve(seasonsData);
      };
      ws.onclose = () => {
        isResolved = true;
        resolve(seasonsData);
      };
    });
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[StreamFlix] Request: ${mediaType} ${tmdbId}`);
      const config = yield getConfig();
      const tmdbType = mediaType === "movie" ? "movie" : "tv";
      const tmdbRes = yield fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${"1865f43a0549ca50d341dd9ab8b29f49"}`);
      const meta = yield tmdbRes.json();
      const targetTitle = (meta.title || meta.name || "").toLowerCase();
      const item = yield findItemInDatabase(tmdbId, targetTitle);
      if (!item) {
        console.warn("[StreamFlix] Item not found in database.");
        return [];
      }
      let path = "";
      if (item.isTV) {
        if (!season || !episode)
          return [];
        const seasonsData = yield getEpisodesFromWS(item.k, season);
        const episodes = seasonsData[season];
        if (episodes) {
          const epKey = Object.keys(episodes)[episode - 1];
          const epData = episodes[epKey];
          if (epData && epData.link)
            path = epData.link;
        }
        if (!path) {
          console.log("[StreamFlix] WS failed, using author's fallback pattern.");
          path = `tv/${item.k}/s${season}/episode${episode}.mkv`;
        }
      } else {
        path = item.l;
      }
      if (!path)
        return [];
      const cleanPath = path.startsWith("/") ? path.substring(1) : path;
      const streams = [];
      const STREAM_HEADERS = Object.assign({}, HEADERS, { "Referer": "https://api.streamflix.app" });
      const premiumBases = [...new Set(config.premium || [])];
      const publicBases = [...new Set(mediaType === "movie" ? config.movies || [] : config.tv || [])];
      premiumBases.forEach((base) => {
        streams.push({
          name: "StreamFlix | Premium",
          title: `${targetTitle.toUpperCase()} - 1080p`,
          url: `${base}${cleanPath}`,
          quality: "1080p",
          headers: STREAM_HEADERS
        });
      });
      publicBases.forEach((base) => {
        streams.push({
          name: "StreamFlix | High Speed",
          title: `${targetTitle.toUpperCase()} - 720p`,
          url: `${base}${cleanPath}`,
          quality: "720p",
          headers: STREAM_HEADERS
        });
      });
      return streams;
    } catch (e) {
      console.error(`[StreamFlix] Fatal Error: ${e.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
if (typeof global !== "undefined") {
  global.getStreams = getStreams;
}
