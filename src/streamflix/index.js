/**
 * StreamFlix — Nuvio Provider
 * 
 * Ported with Sandbox-Safe Proxy Architecture.
 * Fix: Added IMDB ID support to ensure compatibility with Android Mobile.
 */

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const SF_BASE = "https://api.streamflix.app";
const CONFIG_URL = `${SF_BASE}/config/config-streamflixapp.json`;
const FIREBASE_DB = "https://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app";

// Integrated Proxy URL
const PROXY_URL = "https://script.google.com/macros/s/AKfycbxqpHMie9RFfevHFuUZRGiQqidN5iugORvxksVbZt8TEOYjiPylRtZVX50VFnlUMkr7VA/exec"; 

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
        console.log(`[StreamFlix] Request: ID=${tmdbId}, Type=${mediaType}, S=${season}, E=${episode}`);

        // 1. Resolve Metadata (Smart Resolver for TV vs Mobile)
        const mediaInfo = await getMediaDetails(tmdbId, mediaType);
        if (!mediaInfo || !mediaInfo.title) {
            console.log("[StreamFlix] Could not resolve media details (TMDB match failed).");
            return [];
        }

        // 2. Fetch Config (CDN Domains)
        const config = await getConfig();
        if (!config) return [];

        // 3. Find Content Metadata (Proxy Filtering)
        const items = await fetchMetadata(mediaInfo.id || tmdbId, mediaInfo.title);
        if (!items || items.length === 0) {
            console.log("[StreamFlix] No matches found in StreamFlix database.");
            return [];
        }

        // 4. Generate Streams
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
        return allStreams.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));

    } catch (e) {
        console.error(`[StreamFlix] Global Error: ${e.message}`);
        return [];
    }
}

/**
 * Smart Resolver: Handles Numeric IDs (TV) and tt... IDs (Mobile)
 */
async function getMediaDetails(id, type) {
    const isImdb = id.toString().startsWith("tt");
    const tmdbType = type === "tv" ? "tv" : "movie";
    
    try {
        if (isImdb) {
            console.log(`[StreamFlix] Mobile detected (IMDB ID: ${id}). Resolving to TMDB...`);
            const findUrl = `https://api.themoviedb.org/3/find/${id}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
            const res = await fetch(findUrl);
            const data = await res.json();
            const results = type === "tv" ? data.tv_results : data.movie_results;
            
            if (results && results.length > 0) {
                const item = results[0];
                return {
                    id: item.id,
                    title: type === "tv" ? item.name : item.title,
                    year: (item.first_air_date || item.release_date || "").split("-")[0]
                };
            }
            return null;
        } else {
            // Standard TV numeric ID
            const url = `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${TMDB_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            return {
                id: data.id,
                title: type === "tv" ? data.name : data.title,
                year: (data.first_air_date || data.release_date || "").split("-")[0]
            };
        }
    } catch (e) {
        console.error(`[StreamFlix] TMDB Resolver Failed: ${e.message}`);
        return null;
    }
}

async function fetchMetadata(tmdbId, title) {
    if (PROXY_URL) {
        console.log(`[StreamFlix] Searching Proxy: ${title} (ID: ${tmdbId})`);
        const proxyReq = `${PROXY_URL}?tmdb=${tmdbId}&title=${encodeURIComponent(title)}`;
        const res = await fetch(proxyReq);
        const json = await res.json();
        return json.success ? json.data : [];
    }
    return [];
}

async function getConfig() {
    try {
        const res = await fetch(CONFIG_URL, { headers: HEADERS });
        return await res.json();
    } catch (e) { return null; }
}

async function processMovie(item, config, tmdbTitle) {
    const streams = [];
    const path = item.movielink;
    if (!path) return [];

    const langs = detectLanguages(item);
    if (config.premium) {
        config.premium.forEach(base => {
            streams.push(createStreamObject(base + path, "1080p", langs, item, tmdbTitle));
        });
    }
    return streams;
}

async function processTV(item, config, s, e, tmdbTitle) {
    const streams = [];
    const movieKey = item.moviekey;
    if (!movieKey) return [];

    const langs = detectLanguages(item);
    try {
        const epRes = await fetch(`${FIREBASE_DB}/Data/${movieKey}/seasons/${s}/episodes/${e - 1}.json`);
        const epData = await epRes.json();
        if (epData && epData.link) {
            const path = epData.link;
            if (config.premium) config.premium.forEach(base => streams.push(createStreamObject(base + path, "1080p", langs, item, tmdbTitle, s, e, epData.name)));
        }
    } catch (err) {}

    return streams;
}

function createStreamObject(url, quality, langs, item, tmdbTitle, s, e, epName) {
    const titleLines = [
        tmdbTitle + (item.movieyear ? ` (${item.movieyear})` : ""),
        `\uD83D\uDCFA ${quality}`
    ];
    if (s && e) titleLines.push(`\uD83D\uDCCC S${s}E${e} - ${epName || "Episode"}`);
    titleLines.push(`by Kabir \xB7 StreamFlix 2.0 Port`);

    return {
        name: `\uD83C\uDFAC StreamFlix | ${quality}`,
        title: titleLines.join("\n"),
        url,
        quality,
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
    const map = { "hindi": "Hindi", "tamil": "Tamil", "telugu": "Telugu", "english": "English", "kannada": "Kannada", "malayalam": "Malayalam", "bengali": "Bengali" };
    for (const key in map) { if (title.includes(key)) found.push(map[key]); }
    return found.length > 0 ? found : ["Hindi"];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
