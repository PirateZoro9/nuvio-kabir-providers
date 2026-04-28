/**
 * StreamFlix Production Provider for Nuvio
 * 
 * FIXED: 
 * - Surgical Regex Search for data.json (prevents 'Unexpected end of input' crash).
 * - WebSocket Message Buffering (handles fragmented Firebase responses).
 * - Fallback URL Generation (based on original author's pattern).
 * - Removed 'setTimeout' (not supported in sandbox).
 */

const cheerio = require('cheerio-without-node-native');

// --- Configuration & Constants ---
const MAIN_URL = "https://api.streamflix.app";
const WS_URL = "wss://chilflix-410be-default-rtdb.asia-southeast1.firebasedatabase.app/.ws?ns=chilflix-410be-default-rtdb&v=5";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500/";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://api.streamflix.app"
};

// --- State Management ---
let cachedConfig = null;

// --- Networking & API Utilities ---

/**
 * FIXED: This function treats the database as a raw string and uses Regex
 * to extract ONLY the specific object we need. This prevents the sandbox from
 * crashing on the 262KB JSON parse.
 */
async function findItemInDatabase(tmdbId, title) {
    try {
        console.log("[StreamFlix] Surgical database search...");
        const res = await fetch(`${MAIN_URL}/data.json`, { headers: HEADERS });
        const text = await res.text();
        if (!text) return null;

        let block = null;

        // 1. Try search by TMDB ID
        if (tmdbId) {
            const tmdbRegex = new RegExp(`{[^{}]*"tmdb"\\s*:\\s*"${tmdbId}"[^{}]*}`, "i");
            const match = text.match(tmdbRegex);
            if (match) block = match[0];
        }

        // 2. Try search by Title (if TMDB failed)
        if (!block && title) {
            const titleRegex = new RegExp(`{[^{}]*"moviename"\\s*:\\s*"${title}"[^{}]*}`, "i");
            const match = text.match(titleRegex);
            if (match) block = match[0];
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
}

async function getConfig() {
    if (cachedConfig) return cachedConfig;
    try {
        const res = await fetch(`${MAIN_URL}/config/config-streamflixapp.json`, { headers: HEADERS });
        const text = await res.text();
        cachedConfig = JSON.parse(text);
        return cachedConfig;
    } catch (e) {
        return { premium: [], movies: [], tv: [] };
    }
}

// --- WebSocket Logic (Fragment Safe) ---

async function getEpisodesFromWS(movieKey, targetSeason) {
    if (typeof WebSocket === 'undefined') return {};

    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);
        const seasonsData = {};
        let isResolved = false;
        let messageBuffer = ""; // FIXED: Added buffer to handle fragmented messages

        ws.onopen = () => {
            ws.send(JSON.stringify({
                t: "d",
                d: { a: "q", r: 1, b: { p: `Data/${movieKey}/seasons/${targetSeason}/episodes`, h: "" } }
            }));
        };

        ws.onmessage = (event) => {
            if (isResolved) return;
            
            // FIXED: Piece accumulation logic like original author
            messageBuffer += event.data;
            
            try {
                // Only try to parse if it looks like a complete object or status code
                if (!messageBuffer.trim().startsWith("{") && !/^\d+$/.test(messageBuffer.trim())) {
                    return; 
                }

                const json = JSON.parse(messageBuffer);
                messageBuffer = ""; // Clear buffer on success

                if (json.t === 'd' && json.d && json.d.b) {
                    const b = json.d.b;
                    if (b.s === 'ok' || b.d) {
                        if (b.d) {
                            seasonsData[targetSeason] = b.d;
                        }
                        isResolved = true;
                        ws.close();
                        resolve(seasonsData);
                    }
                }
            } catch (e) {
                // If it's too big and still failing, or not JSON yet, keep buffering
                if (messageBuffer.length > 500000) messageBuffer = ""; 
            }
        };

        ws.onerror = () => { isResolved = true; resolve(seasonsData); };
        ws.onclose = () => { isResolved = true; resolve(seasonsData); };
    });
}

// --- Main Extraction Logic ---

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[StreamFlix] Request: ${mediaType} ${tmdbId}`);
        const config = await getConfig();

        // 1. Resolve exact title from TMDB (used for surgical string search)
        const tmdbType = mediaType === 'movie' ? 'movie' : 'tv';
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`);
        const meta = await tmdbRes.json();
        const targetTitle = (meta.title || meta.name || "").toLowerCase();

        // 2. Resolve Item using Surgical Database Search
        const item = await findItemInDatabase(tmdbId, targetTitle);
        
        if (!item) {
            console.warn("[StreamFlix] Item not found in database.");
            return [];
        }

        let path = "";
        if (item.isTV) {
            if (!season || !episode) return [];
            
            // Try WebSocket first
            const seasonsData = await getEpisodesFromWS(item.k, season);
            const episodes = seasonsData[season];
            
            if (episodes) {
                const epKey = Object.keys(episodes)[episode - 1];
                const epData = episodes[epKey];
                if (epData && epData.link) path = epData.link;
            }

            // FIXED: Apply original author's fallback logic if WS fails
            if (!path) {
                console.log("[StreamFlix] WS failed, using author's fallback pattern.");
                path = `tv/${item.k}/s${season}/episode${episode}.mkv`;
            }
        } else {
            path = item.l;
        }

        if (!path) return [];

        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const streams = [];

        // Apply mandatory Referer as per author's code
        const STREAM_HEADERS = Object.assign({}, HEADERS, { "Referer": "https://api.streamflix.app" });

        const premiumBases = [...new Set(config.premium || [])];
        const publicBases = [...new Set(mediaType === 'movie' ? (config.movies || []) : (config.tv || []))];

        premiumBases.forEach(base => {
            streams.push({
                name: "StreamFlix | Premium",
                title: `${targetTitle.toUpperCase()} - 1080p`,
                url: `${base}${cleanPath}`,
                quality: "1080p",
                headers: STREAM_HEADERS
            });
        });

        publicBases.forEach(base => {
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
}

module.exports = { getStreams };

if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
}
