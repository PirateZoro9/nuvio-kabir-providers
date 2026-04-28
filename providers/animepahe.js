/**
 * animepahe - Built from src/animepahe/
 * Generated: 2026-04-28T07:53:12.466Z
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
var MAIN_URL = "https://animepahe.org";
var PROXY = "https://animepaheproxy.phisheranimepahe.workers.dev/?url=";
var HEADERS = {
  "Cookie": "__ddg2_=1234567890",
  "Referer": MAIN_URL,
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
};
var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
var TMDB_BASE = "https://api.themoviedb.org/3";
var TMDB_IMG = "https://image.tmdb.org/t/p/w500";
function http_get(_0) {
  return __async(this, arguments, function* (url, customHeaders = {}) {
    console.log(`[AnimePahe] GET ${url}`);
    let finalUrl = url;
    if (url.includes("animepahe.org")) {
      if (!url.startsWith(PROXY)) {
        finalUrl = PROXY + encodeURIComponent(url);
      }
    }
    const headers = Object.assign({}, HEADERS, customHeaders);
    const res = yield fetch(finalUrl, { headers });
    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status} for ${url}`);
    }
    const text = yield res.text();
    return { body: text, status: res.status };
  });
}
function tmdbGet(url) {
  return __async(this, null, function* () {
    console.log(`[TMDB] GET ${url}`);
    const res = yield fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok)
      throw new Error(`TMDB HTTP Error ${res.status}`);
    const text = yield res.text();
    return { body: text, status: res.status };
  });
}
function MultimediaItem(data) {
  return data;
}
function Episode(data) {
  return data;
}
function StreamResult(data) {
  return {
    name: "AnimePahe",
    title: data.source || data.title,
    url: data.url,
    quality: data.quality ? `${data.quality}p` : "720p",
    headers: data.headers || HEADERS
  };
}
function isStrictAnimeTmdbEntry(data) {
  const genres = Array.isArray(data == null ? void 0 : data.genres) ? data.genres : [];
  const isAnimation = genres.some((g) => g && g.id === 16);
  const isJapanese = (data == null ? void 0 : data.original_language) === "ja";
  return isAnimation && isJapanese;
}
function SearchData(json) {
  this.id = json.id;
  this.slug = json.slug;
  this.title = json.title;
  this.type = json.type;
  this.episodes = json.episodes;
  this.status = json.status;
  this.season = json.season;
  this.year = json.year;
  this.score = json.score;
  this.poster = json.poster;
  this.session = json.session;
}
function SearchResponse(json) {
  this.total = json.total;
  this.data = (json.data || []).map(function(d) {
    return new SearchData(d);
  });
}
function EpisodeData(json) {
  this.id = json.id;
  this.animeId = json.anime_id;
  this.episode = json.episode;
  this.title = json.title;
  this.snapshot = json.snapshot;
  this.session = json.session;
  this.filler = json.filler;
  this.createdAt = json.created_at;
}
function EpisodeResponse(json) {
  this.total = json.total;
  this.perPage = json.per_page;
  this.currentPage = json.current_page;
  this.lastPage = json.last_page;
  this.data = (json.data || []).map(function(d) {
    return new EpisodeData(d);
  });
}
function getType(typeStr) {
  if (!typeStr)
    return "anime";
  var t = typeStr.toLowerCase();
  if (t.indexOf("movie") !== -1)
    return "movie";
  if (t.indexOf("ova") !== -1)
    return "anime";
  if (t.indexOf("special") !== -1)
    return "anime";
  return "anime";
}
function decodeHtmlEntities(str) {
  return String(str || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'").replace(/&nbsp;/g, " ");
}
function uniqueByUrl(items) {
  var seen = {};
  return (items || []).filter(function(item) {
    var key = item && item.url;
    if (!key || seen[key])
      return false;
    seen[key] = true;
    return true;
  });
}
function normalizeMatchText(str) {
  return String(str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\b(tv|movie|anime|season|part|cour)\b/g, " ").replace(/\s+/g, " ").trim();
}
function ordinalSeasonLabel(season) {
  var n = Number(season);
  if (!Number.isFinite(n))
    return "";
  if (n === 1)
    return "1st";
  if (n === 2)
    return "2nd";
  if (n === 3)
    return "3rd";
  return n + "th";
}
function seasonSearchQueries(title, season, seasonInfo) {
  var queries = [];
  if (title && season > 1) {
    queries.push(title + " Season " + season);
    queries.push(title + " " + ordinalSeasonLabel(season) + " Season");
  }
  if (seasonInfo && seasonInfo.name)
    queries.push(seasonInfo.name);
  if (title)
    queries.push(title);
  return Array.from(new Set(queries.filter(Boolean)));
}
function scoreSearchItemTitle(itemTitle, queryTitle, season) {
  var item = normalizeMatchText(itemTitle);
  var query = normalizeMatchText(queryTitle);
  if (!item || !query)
    return 0;
  var score = 0;
  if (item === query)
    score += 100;
  if (item.indexOf(query) !== -1)
    score += 30;
  query.split(" ").forEach(function(token) {
    if (token && item.indexOf(token) !== -1)
      score += 8;
  });
  if (season > 1) {
    var seasonRegex = new RegExp("\\b(" + season + "|" + ordinalSeasonLabel(season) + ")\\b", "i");
    if (seasonRegex.test(itemTitle))
      score += 45;
    if (!seasonRegex.test(itemTitle) && /season|part|cour/i.test(itemTitle))
      score -= 30;
  }
  return score;
}
function findBestAnimePaheSearchResult(title, season, seasonInfo) {
  return __async(this, null, function* () {
    var queries = seasonSearchQueries(title, season, seasonInfo);
    var best = null;
    for (var i = 0; i < queries.length; i++) {
      var query = queries[i];
      var result = yield new Promise(function(resolve) {
        search(query, function(r) {
          resolve(r.success ? r.data || [] : []);
        });
      });
      result.forEach(function(item) {
        var score = scoreSearchItemTitle(item.title, query, season);
        if (!best || score > best.score) {
          best = { item, score };
        }
      });
    }
    return best ? best.item : null;
  });
}
function fetchAniZipMeta(malId) {
  return __async(this, null, function* () {
    if (!malId)
      return null;
    try {
      var url = "https://api.ani.zip/mappings?mal_id=" + encodeURIComponent(malId);
      var res = yield http_get(url, { "Accept": "application/json" });
      if (!res || !res.body)
        return null;
      return JSON.parse(res.body);
    } catch (e) {
      console.error("[AniZip] fetch error:", e.message);
      return null;
    }
  });
}
function buildAniZipEpisodeMap(aniZipMeta) {
  return aniZipMeta && aniZipMeta.episodes ? aniZipMeta.episodes : null;
}
function getAniZipEpisodeMeta(metaEpisodes, episodeNumber) {
  if (!metaEpisodes || episodeNumber == null)
    return null;
  return metaEpisodes[String(episodeNumber)] || null;
}
function scoreFromAniZip(metaEpisode) {
  if (!metaEpisode || !metaEpisode.rating)
    return null;
  var score = parseFloat(metaEpisode.rating);
  return isNaN(score) ? null : score;
}
function getAniZipFanart(aniZipMeta) {
  var images = aniZipMeta && aniZipMeta.images;
  if (!images || !images.length)
    return null;
  for (var i = 0; i < images.length; i++) {
    var image = images[i];
    if (image && image.coverType === "Fanart" && image.url)
      return image.url;
  }
  return null;
}
function parseRecommendations(html) {
  var start = html.indexOf("tab-content anime-recommendation row");
  if (start === -1)
    start = html.indexOf("anime-recommendation row");
  var end = start !== -1 ? html.indexOf("anime-comment", start) : -1;
  var section = start !== -1 ? html.slice(start, end !== -1 ? end : start + 2e4) : "";
  if (!section)
    return [];
  var recommendations = [];
  var cardRegex = /<div[^>]*class="[^"]*col-12 col-sm-6[^"]*"[^>]*>[\s\S]*?<a href="\/anime\/([^"]+)" title="([^"]+)"[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"[\s\S]*?<\/div>\s*<\/div>/gi;
  var match;
  while ((match = cardRegex.exec(section)) !== null) {
    var session = match[1];
    var title = decodeHtmlEntities(match[2].trim());
    var posterUrl = match[3] || null;
    if (!session || !title)
      continue;
    recommendations.push(new MultimediaItem({
      title,
      url: JSON.stringify({
        session,
        name: title,
        sessionDate: Math.floor(Date.now() / 1e3)
      }),
      posterUrl,
      type: "anime",
      headers: HEADERS
    }));
  }
  return uniqueByUrl(recommendations);
}
function toMultimediaItem(item, episodeInfo) {
  var multimedia = new MultimediaItem({
    title: item.animeTitle || item.title,
    url: JSON.stringify({
      session: item.animeSession || item.session,
      name: item.animeTitle || item.title,
      sessionDate: Math.floor(Date.now() / 1e3)
    }),
    posterUrl: item.snapshot || item.poster,
    type: getType(item.type),
    year: item.year,
    score: item.score,
    headers: HEADERS
  });
  if (episodeInfo && item.episode) {
    multimedia.description = "Episode " + item.episode;
  }
  return multimedia;
}
function tmdbAnimeSearch(query) {
  return __async(this, null, function* () {
    try {
      var url = TMDB_BASE + "/search/tv?api_key=" + TMDB_API_KEY + "&query=" + encodeURIComponent(query) + "&with_genres=16&with_origin_country=JP&language=en-US";
      var res = yield tmdbGet(url);
      if (!res || !res.body)
        throw new Error("Empty response");
      var data = JSON.parse(res.body);
      return data.results || [];
    } catch (e) {
      console.error("[TMDB] search error:", e.message);
      return [];
    }
  });
}
function tmdbSeasonInfo(tmdbId, season) {
  return __async(this, null, function* () {
    if (!tmdbId || !season || Number(season) < 1)
      return null;
    try {
      var url = TMDB_BASE + "/tv/" + tmdbId + "/season/" + season + "?api_key=" + TMDB_API_KEY + "&language=en-US";
      var res = yield tmdbGet(url);
      if (!res || !res.body)
        return null;
      var data = JSON.parse(res.body);
      return {
        name: data.name || "",
        seasonNumber: data.season_number || season
      };
    } catch (e) {
      console.error("[TMDB] season info error:", e.message);
      return null;
    }
  });
}
function tmdbToMultimediaItem(item) {
  var title = item.name || item.original_name || item.title || "Unknown";
  var poster = item.poster_path ? TMDB_IMG + item.poster_path : null;
  var banner = item.backdrop_path ? TMDB_IMG + item.backdrop_path : poster;
  var year = item.first_air_date ? parseInt(item.first_air_date.split("-")[0]) : null;
  var score = item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : null;
  var mediaType = item.media_type === "movie" ? "movie" : "anime";
  return new MultimediaItem({
    title,
    url: JSON.stringify({
      tmdb_id: item.id,
      media_type: mediaType,
      name: title,
      sessionDate: Math.floor(Date.now() / 1e3)
    }),
    posterUrl: poster,
    bannerUrl: banner,
    type: mediaType,
    year,
    score,
    description: item.overview || null
  });
}
function search(query, cb) {
  return __async(this, null, function* () {
    try {
      var url = PROXY + encodeURIComponent(MAIN_URL + "/api?m=search&l=8&q=" + encodeURIComponent(query));
      var res = yield http_get(url, HEADERS);
      var data = JSON.parse(res.body);
      var searchRes = new SearchResponse(data);
      var items = searchRes.data.map(function(item) {
        return toMultimediaItem(item, false);
      });
      if (items.length < 4) {
        try {
          var tmdbResults = yield tmdbAnimeSearch(query);
          var tmdbItems = tmdbResults.slice(0, 10).map(tmdbToMultimediaItem);
          items = items.concat(tmdbItems);
        } catch (te) {
          console.error("[Search] TMDB fallback error:", te.message);
        }
      }
      cb({ success: true, data: items });
    } catch (e) {
      cb({ success: false, errorCode: "SEARCH_ERROR", message: e.message });
    }
  });
}
function unpackJS(script) {
  try {
    let skipWS2 = function() {
      while (pos < slen && /\s/.test(script[pos]))
        pos++;
    }, readString2 = function() {
      var q = script[pos];
      pos++;
      var out = "";
      while (pos < slen) {
        var ch = script[pos];
        if (ch === "\\") {
          pos++;
          var esc = script[pos] || "";
          var map = { "n": "\n", "r": "\r", "t": "	", "\\": "\\", "'": "'", '"': '"' };
          out += map[esc] !== void 0 ? map[esc] : esc;
          pos++;
        } else if (ch === q) {
          pos++;
          break;
        } else {
          out += ch;
          pos++;
        }
      }
      return out;
    }, readInt2 = function() {
      var s = pos;
      while (pos < slen && /\d/.test(script[pos]))
        pos++;
      return parseInt(script.slice(s, pos), 10);
    }, skipComma2 = function() {
      skipWS2();
      if (pos < slen && script[pos] === ",")
        pos++;
      skipWS2();
    }, skipPastChar2 = function(ch) {
      while (pos < slen && script[pos] !== ch)
        pos++;
      if (pos < slen)
        pos++;
    };
    var skipWS = skipWS2, readString = readString2, readInt = readInt2, skipComma = skipComma2, skipPastChar = skipPastChar2;
    if (!script.includes("function(p,a,c,k,e")) {
      console.error("[unpackJS] Not a packed script");
      return null;
    }
    var bracePos = script.lastIndexOf("}(");
    if (bracePos === -1) {
      console.error("[unpackJS] Cannot find call site }(");
      return null;
    }
    var pos = bracePos + 2;
    var slen = script.length;
    skipWS2();
    if (script[pos] !== "'" && script[pos] !== '"') {
      console.error("[unpackJS] p not a string, char='" + script[pos] + "' pos=" + pos);
      return null;
    }
    var p = readString2();
    skipComma2();
    var a = readInt2();
    skipComma2();
    var c = readInt2();
    skipComma2();
    var k;
    if (script[pos] === "'" || script[pos] === '"') {
      k = readString2().split("|");
      skipWS2();
      if (pos < slen && script[pos] === ".")
        skipPastChar2(")");
    } else if (script[pos] === "[") {
      pos++;
      k = [];
      while (pos < slen && script[pos] !== "]") {
        skipWS2();
        if (script[pos] === "'" || script[pos] === '"')
          k.push(readString2());
        else {
          k.push("");
          pos++;
        }
        skipWS2();
        if (pos < slen && script[pos] === ",")
          pos++;
      }
    } else {
      console.error("[unpackJS] k not string/array, char='" + script[pos] + "'");
      return null;
    }
    if (isNaN(a) || a < 2) {
      console.error("[unpackJS] invalid radix=" + a);
      return null;
    }
    if (isNaN(c) || c < 0) {
      console.error("[unpackJS] bad word count c=" + c);
      return null;
    }
    console.log("[unpackJS] a=" + a + " c=" + c + " k.len=" + k.length + " p.len=" + p.length);
    return _decode(p, a, c, k);
  } catch (e) {
    console.error("[unpackJS] error:", e.message);
    return null;
  }
}
function _toBase(n, a) {
  var chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (a <= 36)
    return n.toString(a);
  if (n === 0)
    return "0";
  var result = "";
  while (n > 0) {
    result = chars[n % a] + result;
    n = Math.floor(n / a);
  }
  return result;
}
function _decode(p, a, c, k) {
  while (c--) {
    if (k[c] && k[c] !== "") {
      p = p.replace(new RegExp("\\b" + _toBase(c, a) + "\\b", "g"), k[c]);
    }
  }
  return p;
}
function extractKwikStream(kwikUrl) {
  return __async(this, null, function* () {
    try {
      console.log("[Kwik] Fetching embed: " + kwikUrl);
      var res = yield http_get(kwikUrl, { "Referer": kwikUrl });
      var html = res.body;
      var scriptMatch = html.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e[,d]*\)[\s\S]*?)<\/script>/);
      if (!scriptMatch) {
        console.error("[Kwik] No packed script found in embed page");
        return null;
      }
      var unpacked = unpackJS(scriptMatch[1]);
      if (!unpacked) {
        console.error("[Kwik] Failed to unpack script");
        return null;
      }
      console.log("[Kwik] Unpacked (first 300 chars):", unpacked.substring(0, 300));
      var m3u8Match = unpacked.match(/source\s*=\s*'([^']*\.m3u8[^']*)'/);
      if (m3u8Match) {
        console.log("[Kwik] Found m3u8:", m3u8Match[1]);
        return m3u8Match[1];
      }
      var bare = unpacked.match(/(https?:\/\/[^\s'"]+\.m3u8[^\s'"]*)/);
      if (bare) {
        console.log("[Kwik] Found m3u8 (bare):", bare[1]);
        return bare[1];
      }
      console.error("[Kwik] m3u8 not found in unpacked script");
      return null;
    } catch (e) {
      console.error("[Kwik] Error:", e.message);
      return null;
    }
  });
}
function load(url, cb) {
  return __async(this, null, function* () {
    try {
      var loadData = JSON.parse(url);
      if (loadData.tmdb_id && !loadData.session) {
        var title = loadData.name || "";
        try {
          var originalLoadData = Object.assign({}, loadData);
          var seasonInfo = yield tmdbSeasonInfo(loadData.tmdb_id, loadData.season);
          var searchResult = yield findBestAnimePaheSearchResult(title, loadData.season || 1, seasonInfo);
          if (!searchResult)
            throw new Error("Not found on AnimePahe");
          loadData = Object.assign({}, originalLoadData, JSON.parse(searchResult.url));
          if (loadData && loadData.name == null)
            loadData.name = searchResult.title || title;
        } catch (e) {
          console.warn("[load] AnimePahe not found, using TMDB metadata for:", title);
          try {
            var mediaType = loadData.media_type === "movie" ? "movie" : "tv";
            var tmdbDetail = yield tmdbGet(
              TMDB_BASE + "/" + mediaType + "/" + loadData.tmdb_id + "?api_key=" + TMDB_API_KEY + "&language=en-US"
            );
            var td = JSON.parse(tmdbDetail.body);
            cb({ success: true, data: new MultimediaItem({
              title: td.name || td.title || title,
              url,
              posterUrl: td.poster_path ? TMDB_IMG + td.poster_path : null,
              bannerUrl: td.backdrop_path ? TMDB_IMG + td.backdrop_path : null,
              type: mediaType === "movie" ? "movie" : "anime",
              year: td.first_air_date ? parseInt(td.first_air_date.split("-")[0]) : td.release_date ? parseInt(td.release_date.split("-")[0]) : null,
              score: td.vote_average ? parseFloat(td.vote_average.toFixed(1)) : null,
              description: td.overview || null,
              genres: (td.genres || []).map(function(g) {
                return g.name;
              }),
              episodes: [
                new Episode({
                  name: "Movie",
                  url,
                  season: 1,
                  episode: 1,
                  headers: HEADERS
                })
              ]
            }) });
          } catch (te) {
            cb({ success: false, errorCode: "LOAD_ERROR", message: te.message });
          }
          return;
        }
      }
      var session = loadData.session;
      var name = loadData.name;
      var now = Math.floor(Date.now() / 1e3);
      if (loadData.sessionDate && loadData.sessionDate + 600 < now) {
        var refreshBaseData = Object.assign({}, loadData);
        var refreshSeasonInfo = loadData.tmdb_id ? yield tmdbSeasonInfo(loadData.tmdb_id, loadData.season) : null;
        var searchRes = yield findBestAnimePaheSearchResult(name, loadData.season || 1, refreshSeasonInfo);
        if (!searchRes)
          throw new Error("Session refresh failed");
        var freshData = Object.assign({}, refreshBaseData, JSON.parse(searchRes.url));
        session = freshData.session;
      }
      var animeUrl = PROXY + encodeURIComponent(MAIN_URL + "/anime/" + session);
      var res = yield http_get(animeUrl, HEADERS);
      var html = res.body;
      var japaneseTitle = (html.match(/<h2 class="japanese">([^<]+)<\/h2>/) || [])[1] || "";
      var animeTitle = (html.match(/<span class="sr-only unselectable">([^<]+)<\/span>/) || [])[1] || japaneseTitle || name;
      var poster = (html.match(/class="anime-poster"[^>]*>\s*<a[^>]*href="([^"]+)"/) || [])[1] || "";
      var typeMatch = html.match(/<a[^>]*href="\/anime\/type\/[^"]*"[^>]*>([^<]+)<\/a>/);
      var type = typeMatch ? typeMatch[1] : "TV";
      var yearMatch = html.match(/<strong>Aired:<\/strong>[^,]*,\s*(\d{4})/);
      var year = yearMatch ? parseInt(yearMatch[1]) : null;
      var status = "unknown";
      if (html.indexOf('href="/anime/airing"') !== -1)
        status = "ongoing";
      else if (html.indexOf('href="/anime/completed"') !== -1)
        status = "completed";
      var synopsisMatch = html.match(/<div class="anime-synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      var synopsis = synopsisMatch ? synopsisMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      var genres = [];
      var genreSection = html.match(/<div class="anime-genre[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      if (genreSection) {
        genres = Array.from(genreSection[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)).map(function(m) {
          return m[1].trim();
        });
      }
      var malId = null;
      var anilistId = null;
      var malMatch = html.match(/myanimelist\.net\/anime\/(\d+)/);
      var aniMatch = html.match(/anilist\.co\/anime\/(\d+)/);
      if (malMatch)
        malId = malMatch[1];
      if (aniMatch)
        anilistId = aniMatch[1];
      var aniZipMeta = yield fetchAniZipMeta(malId);
      var metaEpisodes = buildAniZipEpisodeMap(aniZipMeta);
      var backgroundFanart = getAniZipFanart(aniZipMeta);
      var recommendations = parseRecommendations(html);
      var episodes = yield fetchAllEpisodes(session, metaEpisodes);
      var result = new MultimediaItem({
        title: animeTitle,
        url,
        posterUrl: poster,
        bannerUrl: backgroundFanart || poster,
        backgroundPosterUrl: backgroundFanart || poster,
        type: getType(type),
        year,
        description: synopsis,
        status,
        genres,
        syncData: { mal: malId, anilist: anilistId },
        recommendations,
        episodes,
        headers: HEADERS
      });
      cb({ success: true, data: result });
    } catch (e) {
      cb({ success: false, errorCode: "LOAD_ERROR", message: e.message });
    }
  });
}
function fetchAllEpisodes(session, metaEpisodes) {
  return __async(this, null, function* () {
    var episodes = [];
    var firstPageUrl = PROXY + encodeURIComponent(MAIN_URL + "/api?m=release&id=" + session + "&sort=episode_asc&page=1");
    try {
      var res = yield http_get(firstPageUrl, HEADERS);
      var data = JSON.parse(res.body);
      var firstPage = new EpisodeResponse(data);
      firstPage.data.forEach(function(ep) {
        episodes.push(createEpisode(ep, session, 1, "sub", metaEpisodes));
        episodes.push(createEpisode(ep, session, 1, "dub", metaEpisodes));
      });
      if (firstPage.lastPage > 1) {
        var pagePromises = [];
        for (var page = 2; page <= firstPage.lastPage; page++) {
          pagePromises.push(fetchEpisodePage(session, page, metaEpisodes));
        }
        var results = yield Promise.all(pagePromises);
        results.forEach(function(pageEps) {
          episodes.push.apply(episodes, pageEps);
        });
      }
      episodes.sort(function(a, b) {
        if (a.episode !== b.episode)
          return a.episode - b.episode;
        if (a.dubStatus === b.dubStatus)
          return 0;
        return a.dubStatus === "sub" ? -1 : 1;
      });
    } catch (e) {
      console.error("[fetchAllEpisodes] Error:", e.message);
    }
    return episodes;
  });
}
function fetchEpisodePage(session, page, metaEpisodes) {
  return __async(this, null, function* () {
    var url = PROXY + encodeURIComponent(MAIN_URL + "/api?m=release&id=" + session + "&sort=episode_asc&page=" + page);
    try {
      var res = yield http_get(url, HEADERS);
      var data = JSON.parse(res.body);
      var pageData = new EpisodeResponse(data);
      var episodes = [];
      pageData.data.forEach(function(ep) {
        episodes.push(createEpisode(ep, session, page, "sub", metaEpisodes));
        episodes.push(createEpisode(ep, session, page, "dub", metaEpisodes));
      });
      return episodes;
    } catch (e) {
      console.error("[fetchEpisodePage] page " + page + " error:", e.message);
      return [];
    }
  });
}
function createEpisode(epData, animeSession, page, dubStatus, metaEpisodes) {
  var meta = getAniZipEpisodeMeta(metaEpisodes, epData.episode);
  var title = meta && meta.title && meta.title.en || epData.title || "Episode " + epData.episode;
  var suffix = dubStatus === "dub" ? " (Dub)" : "";
  var urlPayload = JSON.stringify({
    mainUrl: MAIN_URL,
    is_play_page: true,
    episode_num: epData.episode,
    page: page - 1,
    session: animeSession,
    episode_session: epData.session,
    dubStatus
  });
  return new Episode({
    name: title + suffix,
    url: urlPayload,
    season: meta && meta.seasonNumber || 1,
    episode: epData.episode,
    posterUrl: meta && meta.image || epData.snapshot,
    description: meta && meta.overview || "",
    score: scoreFromAniZip(meta),
    runTime: meta && meta.runtime ? meta.runtime : void 0,
    airDate: epData.createdAt,
    dubStatus,
    headers: HEADERS
  });
}
function loadStreams(url, cb) {
  return __async(this, null, function* () {
    try {
      var data = JSON.parse(url);
      var episodeUrl = PROXY + encodeURIComponent(MAIN_URL + "/play/" + data.session + "/" + data.episode_session);
      console.log("[loadStreams] Fetching play page:", episodeUrl);
      var res = yield http_get(episodeUrl, HEADERS);
      var html = res.body;
      var streams = [];
      var kwikRegex = /<button[^>]*data-src="(https:\/\/kwik\.cx\/e\/[^"]*)"[^>]*>([\s\S]*?)<\/button>/g;
      var match;
      var wantDub = data.dubStatus === "dub";
      while ((match = kwikRegex.exec(html)) !== null) {
        var kwikHref = match[1];
        var btnText = match[2].replace(/<[^>]+>/g, " ").trim();
        var isDub = btnText.toLowerCase().includes("eng");
        if (isDub !== wantDub)
          continue;
        var qualityMatch = btnText.match(/(\d{3,4})p/);
        var quality = qualityMatch ? parseInt(qualityMatch[1]) : 0;
        var label = (btnText.split("\xB7")[0] || "").trim() || "Kwik";
        console.log("[loadStreams] Extracting Kwik [" + (isDub ? "DUB" : "SUB") + "]:", kwikHref);
        var streamUrl = yield extractKwikStream(kwikHref);
        if (streamUrl) {
          streams.push(new StreamResult({
            url: streamUrl,
            quality,
            source: "AnimePahe " + label + " [" + (isDub ? "DUB" : "SUB") + "]",
            headers: __spreadProps(__spreadValues({}, HEADERS), { "Referer": "https://kwik.cx/" })
          }));
        } else {
          console.error("[loadStreams] Failed to extract stream for:", kwikHref);
        }
      }
      console.log("[loadStreams] Total streams found:", streams.length);
      cb({ success: true, data: streams });
    } catch (e) {
      console.error("[loadStreams] Fatal error:", e.message);
      cb({ success: false, errorCode: "STREAM_ERROR", message: e.message });
    }
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      console.log(`[AnimePahe] Request: ${mediaType} ${tmdbId} S:${season} E:${episode}`);
      const tmdbUrl = `${TMDB_BASE}/${mediaType === "movie" ? "movie" : "tv"}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const tRes = yield tmdbGet(tmdbUrl);
      const tData = JSON.parse(tRes.body);
      if (!isStrictAnimeTmdbEntry(tData)) {
        console.log(`[AnimePahe] Content is not Japanese Animation (ID: ${tmdbId}, Lang: ${tData.original_language}). Skipping.`);
        return [];
      }
      const title = tData.name || tData.title || "";
      if (!title)
        return [];
      const loadPayload = JSON.stringify({
        tmdb_id: tmdbId,
        media_type: mediaType,
        name: title,
        season,
        episode
      });
      const loadResult = yield new Promise((resolve, reject) => {
        load(loadPayload, (res) => {
          if (res.success)
            resolve(res.data);
          else
            reject(new Error(res.message || res.errorCode));
        });
      });
      if (!loadResult || !loadResult.episodes)
        return [];
      let targetEpisodes = [];
      if (mediaType === "movie") {
        targetEpisodes = [loadResult.episodes[0]];
      } else {
        targetEpisodes = loadResult.episodes.filter(function(ep) {
          return Number(ep.episode) === Number(episode) && (ep.season == null || Number(ep.season) === Number(season));
        });
        if (!targetEpisodes.length) {
          targetEpisodes = loadResult.episodes.filter(function(ep) {
            return Number(ep.episode) === Number(episode);
          });
        }
      }
      if (!targetEpisodes.length)
        return [];
      let allStreams = [];
      for (const ep of targetEpisodes) {
        try {
          const streamRes = yield new Promise((resolve, reject) => {
            loadStreams(ep.url, (res) => {
              if (res.success)
                resolve(res.data);
              else
                reject(new Error(res.message));
            });
          });
          if (streamRes && streamRes.length) {
            allStreams = allStreams.concat(streamRes);
          }
        } catch (e) {
          console.warn(`[AnimePahe] Failed stream variation: ${e.message}`);
        }
      }
      const finalStreams = uniqueByUrl(allStreams);
      return finalStreams;
    } catch (error) {
      console.error(`[AnimePahe] Error: ${error.message}`);
      return [];
    }
  });
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = { getStreams };
}
