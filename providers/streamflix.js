/**
 * streamflix - Built from src/streamflix/
 * Generated: 2026-04-28T04:43:19.792Z
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
      const res = yield fetch(`${MAIN_URL}/data.json`, { headers: HEADERS });
      const json = yield res.json();
      if (json && json.data) {
        cachedData = json.data.filter((i) => i.moviename && i.moviekey);
        lastSync = now;
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
      cachedConfig = yield res.json();
      return cachedConfig;
    } catch (e) {
      return { premium: [], movies: [], tv: [] };
    }
  });
}
function getEpisodesFromWS(movieKey, totalSeasons = 1) {
  return __async(this, null, function* () {
    if (typeof WebSocket === "undefined") {
      console.error("[StreamFlix] WebSocket is not supported in this environment.");
      return {};
    }
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);
      const seasonsData = {};
      let seasonsCompleted = 0;
      let isResolved = false;
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          ws.close();
          resolve(seasonsData);
        }
      }, 1e4);
      ws.onopen = () => {
        for (let s = 1; s <= totalSeasons; s++) {
          ws.send(JSON.stringify({
            t: "d",
            d: { a: "q", r: s, b: { p: `Data/${movieKey}/seasons/${s}/episodes`, h: "" } }
          }));
        }
      };
      ws.onmessage = (event) => {
        if (isResolved)
          return;
        const text = event.data;
        if (/^\d+$/.test(text.trim()))
          return;
        try {
          const json = JSON.parse(text);
          if (json.t === "d" && json.d) {
            const b = json.d.b;
            if (b && b.s === "ok") {
              seasonsCompleted++;
              if (seasonsCompleted >= totalSeasons) {
                isResolved = true;
                clearTimeout(timeout);
                ws.close();
                resolve(seasonsData);
              }
            } else if (b && b.d) {
              const path = b.p || "";
              const seasonMatch = path.match(/seasons\/(\d+)\/episodes/);
              const sNum = seasonMatch ? parseInt(seasonMatch[1]) : 1;
              if (!seasonsData[sNum])
                seasonsData[sNum] = {};
              Object.keys(b.d).forEach((k) => seasonsData[sNum][k] = b.d[k]);
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
function mapItem(item) {
  const poster = item.movieposter ? String(item.movieposter).replace(/^\/+/, "") : "";
  return {
    title: item.moviename,
    url: `sf_${item.moviekey}`,
    posterUrl: poster ? `${TMDB_IMAGE_BASE}${poster}` : null,
    type: item.isTV ? "series" : "movie"
  };
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    var _a;
    try {
      console.log(`[StreamFlix] Request: ${mediaType} ${tmdbId}`);
      const data = yield syncData();
      const config = yield getConfig();
      let item = data.find((i) => {
        var _a2;
        return i.tmdb === tmdbId || ((_a2 = i.movieimdb) == null ? void 0 : _a2.includes(tmdbId));
      });
      if (!item && /^\d+$/.test(tmdbId)) {
        const tmdbType = mediaType === "movie" ? "movie" : "tv";
        const res = yield fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${"1865f43a0549ca50d341dd9ab8b29f49"}`);
        const meta = yield res.json();
        const title = (meta.title || meta.name || "").toLowerCase();
        if (title) {
          item = data.find((i) => {
            var _a2;
            return ((_a2 = i.moviename) == null ? void 0 : _a2.toLowerCase()) === title;
          });
        }
      }
      if (!item)
        return [];
      let path = "";
      if (item.isTV) {
        if (!season || !episode)
          return [];
        const seasonsData = yield getEpisodesFromWS(item.moviekey, season);
        const epData = (_a = seasonsData[season]) == null ? void 0 : _a[episode - 1];
        if (epData && epData.link)
          path = epData.link;
      } else {
        path = item.movielink;
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
          title: `${item.moviename} - 1080p`,
          url: `${base}${cleanPath}`,
          quality: "1080p",
          headers: HEADERS
        });
      });
      publicBases.forEach((base) => {
        streams.push({
          name: "StreamFlix | High Speed",
          title: `${item.moviename} - 720p`,
          url: `${base}${cleanPath}`,
          quality: "720p",
          headers: HEADERS
        });
      });
      return streams;
    } catch (e) {
      console.error(`[StreamFlix] getStreams error: ${e.message}`);
      return [];
    }
  });
}
module.exports = { getStreams, getHome };
if (typeof global !== "undefined") {
  global.getStreams = getStreams;
  global.getHome = getHome;
}
