/**
 * onetouchtv - Built from src/onetouchtv/
 * Generated: 2026-05-01T03:46:56.405Z
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

// src/onetouchtv/index.js
var CryptoJS = require("crypto-js");
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var MAIN_URL = "https://api3.devcorp.me";
var TMDB_BASE = "https://api.themoviedb.org/3";
var AES_KEY = CryptoJS.enc.Utf8.parse("im72charPasswordofdInitVectorStm");
var AES_IV = CryptoJS.enc.Utf8.parse("im72charPassword");
function decryptOneTouch(input) {
  try {
    if (!input || typeof input !== "string")
      return null;
    let normalized = input.replace(/-_\./g, "/").replace(/@/g, "+").replace(/\s+/g, "");
    const pad = normalized.length % 4;
    if (pad !== 0) {
      normalized += "=".repeat(4 - pad);
    }
    const decrypted = CryptoJS.AES.decrypt(normalized, AES_KEY, {
      iv: AES_IV,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const rawText = decrypted.toString(CryptoJS.enc.Utf8);
    if (!rawText)
      throw new Error("Empty decryption result");
    const json = JSON.parse(rawText);
    return json.result;
  } catch (e) {
    console.error(`[OneTouchTV] Decryption Error: ${e.message}`);
    return null;
  }
}
function fetchEncrypted(path) {
  return __async(this, null, function* () {
    const url = path.startsWith("http") ? path : `${MAIN_URL}${path}`;
    console.log(`[OneTouchTV] Requesting API: ${path}`);
    const response = yield fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://onetouchtv.xyz/"
      }
    });
    if (!response.ok)
      throw new Error(`HTTP Error: ${response.status}`);
    const encryptedData = yield response.text();
    return decryptOneTouch(encryptedData);
  });
}
function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
  return __async(this, null, function* () {
    try {
      console.log(`[OneTouchTV] Request: ID=${tmdbId}, Type=${mediaType}, S=${season}, E=${episode}`);
      let mediaInfo;
      const isNumericId = /^\d+$/.test(tmdbId);
      if (isNumericId) {
        mediaInfo = yield getTMDBDetails(tmdbId, mediaType);
      }
      if (!mediaInfo) {
        console.log("[OneTouchTV] TMDB resolution skipped or failed. Using fallback.");
        mediaInfo = {
          title: tmdbId,
          year: null,
          isTv: mediaType === "tv" || mediaType === "series"
        };
      }
      console.log(`[OneTouchTV] Target: ${mediaInfo.title} (${mediaInfo.year || "N/A"})`);
      const searchResults = yield fetchEncrypted(`/vod/search?keyword=${encodeURIComponent(mediaInfo.title)}`);
      if (!searchResults || !Array.isArray(searchResults)) {
        console.log("[OneTouchTV] No search results found.");
        return [];
      }
      const match = searchResults.find((r) => calculateSimilarity(r.title, mediaInfo.title) > 0.75);
      if (!match) {
        console.log("[OneTouchTV] No suitable title match found in search results.");
        return [];
      }
      console.log(`[OneTouchTV] Hit Found: ${match.title} (ID: ${match.id})`);
      const details = yield fetchEncrypted(`/vod/${match.id}/detail`);
      if (!details || !details.episodes) {
        console.log("[OneTouchTV] Could not retrieve media details or episodes.");
        return [];
      }
      let targetEpisode = null;
      if (mediaType === "movie" || !mediaInfo.isTv) {
        targetEpisode = details.episodes[0];
      } else {
        targetEpisode = details.episodes.find((ep) => {
          const epNum = parseInt(ep.episode.replace(/\D/g, ""));
          return epNum === parseInt(episode);
        });
      }
      if (!targetEpisode) {
        console.log(`[OneTouchTV] Episode ${episode} not found in the list.`);
        return [];
      }
      console.log(`[OneTouchTV] Resolved Episode: ${targetEpisode.episode} (PlayID: ${targetEpisode.playId})`);
      const sourcesData = yield fetchEncrypted(`/vod/${targetEpisode.identifier}/episode/${targetEpisode.playId}`);
      if (!sourcesData || !sourcesData.sources) {
        console.log("[OneTouchTV] No streaming sources found for this episode.");
        return [];
      }
      const streams = [];
      sourcesData.sources.forEach((src) => {
        if (!src.url)
          return;
        const quality = normalizeQuality(src.quality);
        streams.push({
          name: `\u{1F4FA} OneTouch | ${src.name || "Server"}`,
          title: `${mediaInfo.title}${mediaInfo.isTv ? ` E${episode}` : ""} (${mediaInfo.year || "N/A"})
\u{1F4CC} ${quality} \xB7 ${src.type === "hls" ? "HLS" : "MP4"}
by Kabir \xB7 OneTouch Port`,
          url: src.url,
          quality,
          headers: src.headers || {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://api3.devcorp.me/"
          }
        });
      });
      const subtitles = (sourcesData.tracks || []).map((t) => ({
        label: t.name || "Unknown",
        url: t.file
      })).filter((t) => t.url);
      if (subtitles.length > 0) {
        streams.forEach((s) => s.subtitles = subtitles);
        console.log(`[OneTouchTV] Attached ${subtitles.length} subtitle tracks.`);
      }
      console.log(`[OneTouchTV] Successfully retrieved ${streams.length} stream(s).`);
      return streams.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
    } catch (e) {
      console.error(`[OneTouchTV] Global Error: ${e.message}`);
      return [];
    }
  });
}
function getTMDBDetails(id, type) {
  return __async(this, null, function* () {
    try {
      const isTv = type === "tv" || type === "series";
      const url = `${TMDB_BASE}/${isTv ? "tv" : "movie"}/${id}?api_key=${TMDB_API_KEY}`;
      const res = yield fetch(url);
      const data = yield res.json();
      return {
        title: isTv ? data.name : data.title,
        year: (data.first_air_date || data.release_date || "").split("-")[0],
        isTv
      };
    } catch (e) {
      return null;
    }
  });
}
function calculateSimilarity(s1, s2) {
  if (!s1 || !s2)
    return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b)
    return 1;
  if (a.includes(b) || b.includes(a))
    return 0.9;
  const words1 = a.split(/\s+/);
  const words2 = b.split(/\s+/);
  const intersection = words1.filter((w) => words2.includes(w));
  return intersection.length / Math.max(words1.length, words2.length);
}
function normalizeQuality(q) {
  if (!q)
    return "720p";
  const str = q.toString().toLowerCase();
  if (str.includes("1080"))
    return "1080p";
  if (str.includes("720"))
    return "720p";
  if (str.includes("480"))
    return "480p";
  return "720p";
}
module.exports = { getStreams };
if (typeof global !== "undefined") {
  global.getStreams = getStreams;
}
