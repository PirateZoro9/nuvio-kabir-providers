/**
 * StreamFlix — Nuvio Provider
 * 
 * Ported with Sandbox-Safe Proxy Architecture to avoid 2.7MB JSON truncation.
 * Features: Multi-Audio, Firebase WebSockets for TV, Dynamic CDN Rotation.
 */

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const SF_BASE = "https://api.streamflix.app";
const CONFIG_URL = `${SF_BASE}/config/config-streamflixapp.json`;
const FIREBASE_DB = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app";

// ⚠️ IMPORTANT: Update this URL after deploying your Google Apps Script Proxy
const PROXY_URL = "https://script.google.com/macros/s/AKfycbzKvHoxL0rV7PGsti4EN0oNMoiFmizAmipZ2R_ZoCQeIyAC_xeXVBeI2vB2GDa4fGIYYg/exec"; 

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://api.streamflix.app/",
    "Accept": "application/json, text/plain, */*"
};

/**
 * Main Nuvio Entry Point
 */
async function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {
    try {
        console.log(`[StreamFlix] Request: TMDB=${tmdbId}, Type=${mediaType}, S=${season}, E=${episode}`);

        // 1. Resolve TMDB Title
        let mediaInfo;
        const isNumericId = /^\d+$/.test(tmdbId);
        if (isNumericId) {
            mediaInfo = await getTMDBDetails(tmdbId, mediaType);
        } else {
            console.log("[StreamFlix] Non-numeric ID provided, using as title.");
            mediaInfo = { title: tmdbId, year: "" };
        }
        
        if (!mediaInfo) return [];

        // 2. Fetch Config (CDN Domains)
        const config = await getConfig();
        if (!config) return [];

        // 3. Find Content Metadata (via Proxy or Direct)
        const items = await fetchMetadata(tmdbId, mediaInfo.title);
        if (!items || items.length === 0) {
            console.log("[StreamFlix] No matches found.");
            return [];
        }

        // 4. Generate Streams for all matches (Supports Multi-Language entries)
        const allStreams = [];
        for (const item of items) {
            let streams = [];
            if (mediaType === "movie") {
                streams = await processMovie(item, config, mediaInfo.title);
            } else {
                streams = await processTV(item, config, season, episode, mediaInfo.title);
            }
            allStreams.push(...streams);
        }

        // 5. Final Sort (1080p first)
        return allStreams.sort((a, b) => {
            const qA = parseInt(a.quality) || 0;
            const qB = parseInt(b.quality) || 0;
            return qB - qA;
        });

    } catch (e) {
        console.error(`[StreamFlix] Error: ${e.message}`);
        return [];
    }
}

/**
 * Metadata Fetcher: Uses Proxy to bypass Hermes memory limits
 */
async function fetchMetadata(tmdbId, title) {
    if (PROXY_URL) {
        console.log("[StreamFlix] Using Proxy for metadata...");
        const proxyReq = `${PROXY_URL}?tmdb=${tmdbId}&title=${encodeURIComponent(title)}`;
        const res = await fetch(proxyReq);
        const json = await res.json();
        return json.success ? json.data : [];
    } else {
        console.log("[StreamFlix] WARNING: No Proxy defined. Attempting direct fetch (High Crash Risk in Nuvio)...");
        const res = await fetch(`${SF_BASE}/data.json`, { headers: HEADERS });
        const text = await res.text(); 
        const json = JSON.parse(text);
        const data = json.data || [];
        
        return data.filter(item => 
            (item.tmdb && item.tmdb.toString() === tmdbId.toString()) || 
            (item.moviename && item.moviename.toLowerCase().includes(title.toLowerCase()))
        );
    }
}

async function getConfig() {
    try {
        const res = await fetch(CONFIG_URL, { headers: HEADERS });
        return await res.json();
    } catch (e) {
        console.error("[StreamFlix] Config fetch failed");
        return null;
    }
}

async function getTMDBDetails(tmdbId, mediaType) {
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return {
            title: mediaType === "tv" ? data.name : data.title,
            year: (data.first_air_date || data.release_date || "").split("-")[0]
        };
    } catch (e) { return null; }
}

async function processMovie(item, config, tmdbTitle) {
    const streams = [];
    const path = item.movielink;
    if (!path) return [];

    const langs = detectLanguages(item);
    
    // Add Premium Links
    if (config.premium) {
        config.premium.forEach(base => {
            streams.push(createStreamObject(base + path, "1080p", langs, item, tmdbTitle));
        });
    }

    // Add Standard Links
    if (config.movies) {
        config.movies.forEach(base => {
            streams.push(createStreamObject(base + path, "720p", langs, item, tmdbTitle));
        });
    }

    return streams;
}

async function processTV(item, config, s, e, tmdbTitle) {
    const streams = [];
    const movieKey = item.moviekey;
    if (!movieKey) return [];

    const langs = detectLanguages(item);

    // Try to get direct episode link from Firebase
    try {
        const epRes = await fetch(`${FIREBASE_DB}/Data/${movieKey}/seasons/${s}/episodes/${e - 1}.json`);
        const epData = await epRes.json();
        
        if (epData && epData.link) {
            const path = epData.link;
            if (config.premium) {
                config.premium.forEach(base => {
                    streams.push(createStreamObject(base + path, "1080p", langs, item, tmdbTitle, s, e, epData.name));
                });
            }
            if (config.tv) {
                config.tv.forEach(base => {
                    streams.push(createStreamObject(base + path, "720p", langs, item, tmdbTitle, s, e, epData.name));
                });
            }
        }
    } catch (err) {
        console.log("[StreamFlix] Firebase lookup failed, trying pattern fallback...");
    }

    // Fallback Pattern if Firebase fails
    if (streams.length === 0 && config.premium) {
        const fallbackPath = `tv/${movieKey}/s${s}/episode${e}.mkv`;
        config.premium.forEach(base => {
            streams.push(createStreamObject(base + fallbackPath, "720p", langs, item, tmdbTitle, s, e, "Episode " + e));
        });
    }

    return streams;
}

function createStreamObject(url, quality, langs, item, tmdbTitle, s, e, epName) {
    const langStr = langs.length > 1 ? "Multi" : (langs[0] || "Hindi");
    const titleLines = [
        tmdbTitle + (item.movieyear ? ` (${item.movieyear})` : ""),
        `📺 ${quality}  🔊 ${langs.join(" + ")}`
    ];
    
    if (s && e) {
        titleLines.push(`📌 S${s}E${e} - ${epName || "Episode"}`);
    }

    titleLines.push(`⭐ Rating: ${item.movierating || "N/A"}`);
    titleLines.push(`by Kabir · StreamFlix 2.0 Port`);

    return {
        name: `🎬 StreamFlix | ${quality} | ${langStr}`,
        title: titleLines.join("\n"),
        url: url,
        quality: quality,
        headers: {
            "User-Agent": HEADERS["User-Agent"],
            "Referer": "https://api.streamflix.app/",
            "Origin": "https://api.streamflix.app"
        }
    };
}

function detectLanguages(item) {
    const title = (item.moviename || "").toLowerCase();
    const found = [];
    const map = {
        "hindi": "Hindi",
        "tamil": "Tamil",
        "telugu": "Telugu",
        "english": "English",
        "kannada": "Kannada",
        "malayalam": "Malayalam",
        "bengali": "Bengali"
    };

    for (const key in map) {
        if (title.includes(key)) found.push(map[key]);
    }

    return found.length > 0 ? found : ["Hindi"];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
