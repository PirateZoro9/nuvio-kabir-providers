/**
 * doflix - Built from src/doflix/
 * Generated: 2026-04-17T07:52:34.258Z
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

// src/doflix/index.js
var MAIN_URL = "https://panel.watchkaroabhi.com";
var API_KEY = "qNhKLJiZVyoKdi9NCQGz8CIGrpUijujE";
var HEADERS = {
  "Connection": "Keep-Alive",
  "User-Agent": "dooflix",
  "X-App-Version": "305",
  "X-Package-Name": "com.king.moja",
  "Accept": "application/json"
};
function normalizeQuality(qualityString) {
  if (!qualityString)
    return "Unknown";
  const q = qualityString.toUpperCase();
  if (q === "4K" || q === "2160P")
    return "2160p";
  if (q === "FHD" || q === "1080P")
    return "1080p";
  if (q === "HD" || q === "720P")
    return "720p";
  if (q === "SD" || q === "480P")
    return "480p";
  if (q === "360P")
    return "360p";
  return q;
}
function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    try {
      let linksUrl = "";
      if (mediaType === "movie") {
        linksUrl = `${MAIN_URL}/api/3/movie/${tmdbId}/links?api_key=${API_KEY}`;
      } else if (mediaType === "tv") {
        if (!season || !episode)
          return [];
        linksUrl = `${MAIN_URL}/api/3/tv/${tmdbId}/season/${season}/episode/${episode}/links?api_key=${API_KEY}`;
      } else {
        return [];
      }
      const response = yield fetch(linksUrl, { method: "GET", headers: HEADERS });
      if (!response.ok) {
        console.error(`[DoFlix] API Error: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = yield response.json();
      const linksArray = mediaType === "movie" ? data.links : data.results;
      if (!linksArray || !Array.isArray(linksArray)) {
        return [];
      }
      const streams = [];
      linksArray.forEach((linkObj) => {
        if (linkObj && linkObj.url) {
          const host = linkObj.host || "DoFlix Stream";
          const rawQuality = linkObj.quality || "Auto";
          const finalQuality = normalizeQuality(rawQuality);
          streams.push({
            name: "DoFlix",
            title: `${host} - ${finalQuality}`,
            url: linkObj.url,
            quality: finalQuality,
            // The Kotlin code uses this specific referer for video playback
            headers: {
              "Referer": "https://molop.art/"
            }
          });
        }
      });
      return streams;
    } catch (e) {
      console.error("[DoFlix] getStreams error:", e.message);
      return [];
    }
  });
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = { getStreams };
}
