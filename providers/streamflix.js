/**
 * streamflix - Built from src/streamflix/
 * Generated: 2026-04-28T04:49:49.948Z
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
var TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500/";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://api.streamflix.app"
};
var cachedData = [];
var lastSync = 0;
var cachedConfig = null;
function syncData() {
  return __async(this, null, function* () {
    const now = Date.now();
    if (cachedData.length > 0 && now - lastSync < 36e5)
      return cachedData;
    try {
      console.log("[StreamFlix] Syncing database...");
      const res = yield fetch(`${MAIN_URL}/data.json`, { headers: HEADERS });
      const text = yield res.text();
      if (!text)
        throw new Error("Empty database response");
      const json = JSON.parse(text);
      if (json && json.data) {
        cachedData = json.data.filter((i) => i.moviename && i.moviekey).map((i) => ({
          n: i.moviename.toLowerCase(),
          k: i.moviekey,
          t: i.tmdb,
          i: i.movieimdb,
          p: i.movieposter,
          l: i.movielink,
          isTV: !!i.isTV
        }));
        lastSync = now;
        console.log(`[StreamFlix] Database synced: ${cachedData.length} items.`);
      }
    } catch (e) {
      console.error(`[StreamFlix] Data sync failed: ${e.message}`);
    }
    return cachedData;
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
      ws.onopen = () => {
        ws.send(JSON.stringify({
          t: "d",
          d: { a: "q", r: 1, b: { p: `Data/${movieKey}/seasons/${targetSeason}/episodes`, h: "" } }
        }));
      };
      ws.onmessage = (event) => {
        if (isResolved)
          return;
        const text = event.data;
        try {
          const json = JSON.parse(text);
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
function getHome(cb) {
  return __async(this, null, function* () {
    try {
      const data = yield syncData();
      const home = {
        "New Movies": data.filter((i) => !i.isTV).slice(0, 15).map(mapItem),
        "New Series": data.filter((i) => i.isTV).slice(0, 15).map(mapItem)
      };
      cb({ success: true, data: home });
    } catch (e) {
      cb({ success: false, message: e.message });
    }
  });
}
function mapItem(i) {
  const poster = i.p ? String(i.p).replace(/^\/+/, "") : "";
  return {
    title: i.n.toUpperCase(),
    url: `sf_${i.k}`,
    posterUrl: poster ? `${TMDB_IMAGE_BASE}${poster}` : null,
    type: i.isTV ? "series" : "movie"
  };
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[StreamFlix] Request: ${mediaType} ${tmdbId}`);
      const data = yield syncData();
      const config = yield getConfig();
      let item = data.find((i) => i.t === tmdbId || i.i && i.i.includes(tmdbId));
      if (!item && /^\d+$/.test(tmdbId)) {
        const tmdbType = mediaType === "movie" ? "movie" : "tv";
        const res = yield fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${"1865f43a0549ca50d341dd9ab8b29f49"}`);
        const meta = yield res.json();
        const title = (meta.title || meta.name || "").toLowerCase();
        if (title) {
          item = data.find((i) => i.n === title);
        }
      }
      if (!item)
        return [];
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
      } else {
        path = item.l;
      }
      if (!path)
        return [];
      const cleanPath = path.startsWith("/") ? path.substring(1) : path;
      const streams = [];
      const premiumBases = [...new Set(config.premium || [])];
      const publicBases = [...new Set(mediaType === "movie" ? config.movies || [] : config.tv || [])];
      premiumBases.forEach((base) => {
        streams.push({
          name: "StreamFlix | Premium",
          title: `${item.n.toUpperCase()} - 1080p`,
          url: `${base}${cleanPath}`,
          quality: "1080p",
          headers: HEADERS
        });
      });
      publicBases.forEach((base) => {
        streams.push({
          name: "StreamFlix | High Speed",
          title: `${item.n.toUpperCase()} - 720p`,
          url: `${base}${cleanPath}`,
          quality: "720p",
          headers: HEADERS
        });
      });
      return streams;
    } catch (e) {
      console.error(`[StreamFlix] Fatal Error: ${e.message}`);
      return [];
    }
  });
}
module.exports = { getStreams, getHome };
if (typeof global !== "undefined") {
  global.getStreams = getStreams;
  global.getHome = getHome;
}
