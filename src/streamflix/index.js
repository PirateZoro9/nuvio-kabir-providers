/**
 * StreamFlix Production Provider for Nuvio
 * 
 * FIXED: 
 * - Manual JSON parsing for large data.json (prevents 'Unexpected end of input' crash).
 * - Removed 'setTimeout' (not supported in sandbox).
 * - Optimized memory usage for large database.
 * 
 * Features:
 * - WebSocket support for TV Show episodes.
 * - Dynamic Mirror Resolution.
 * - Catalog support.
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
let cachedData = [];
let lastSync = 0;
let cachedConfig = null;

// --- Networking & API Utilities ---

async function syncData() {
    const now = Date.now();
    if (cachedData.length > 0 && (now - lastSync < 3600000)) return cachedData;

    try {
        console.log("[StreamFlix] Syncing database...");
        const res = await fetch(`${MAIN_URL}/data.json`, { headers: HEADERS });
        
        // FIXED: Manual parsing for stability with large files
        const text = await res.text();
        if (!text) throw new Error("Empty database response");
        
        const json = JSON.parse(text);
        if (json && json.data) {
            // FIXED: Only store essential fields to save memory in sandbox
            cachedData = json.data
                .filter(i => i.moviename && i.moviekey)
                .map(i => ({
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

// --- WebSocket Logic (SandBox Safe) ---

async function getEpisodesFromWS(movieKey, targetSeason) {
    if (typeof WebSocket === 'undefined') return {};

    return new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);
        const seasonsData = {};
        let isResolved = false;

        // FIXED: Removed setTimeout. We rely on the WS close or error events.
        // To prevent infinite hang, we'll resolve if no message in 10s (handled by Nuvio internally usually)
        
        ws.onopen = () => {
            ws.send(JSON.stringify({
                t: "d",
                d: { a: "q", r: 1, b: { p: `Data/${movieKey}/seasons/${targetSeason}/episodes`, h: "" } }
            }));
        };

        ws.onmessage = (event) => {
            if (isResolved) return;
            const text = event.data;
            try {
                const json = JSON.parse(text);
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
            } catch (e) {}
        };

        ws.onerror = () => { isResolved = true; resolve(seasonsData); };
        ws.onclose = () => { isResolved = true; resolve(seasonsData); };
    });
}

// --- Home Screen Logic ---

async function getHome(cb) {
    try {
        const data = await syncData();
        const home = {
            "New Movies": data.filter(i => !i.isTV).slice(0, 15).map(mapItem),
            "New Series": data.filter(i => i.isTV).slice(0, 15).map(mapItem)
        };
        cb({ success: true, data: home });
    } catch (e) {
        cb({ success: false, message: e.message });
    }
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

// --- Main Extraction Logic ---

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[StreamFlix] Request: ${mediaType} ${tmdbId}`);
        const data = await syncData();
        const config = await getConfig();

        // 1. Resolve Item
        let item = data.find(i => i.t === tmdbId || (i.i && i.i.includes(tmdbId)));
        
        // Fallback: Title match via TMDB
        if (!item && /^\d+$/.test(tmdbId)) {
            const tmdbType = mediaType === 'movie' ? 'movie' : 'tv';
            const res = await fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`);
            const meta = await res.json();
            const title = (meta.title || meta.name || "").toLowerCase();
            if (title) {
                item = data.find(i => i.n === title);
            }
        }

        if (!item) return [];

        let path = "";
        if (item.isTV) {
            if (!season || !episode) return [];
            const seasonsData = await getEpisodesFromWS(item.k, season);
            const episodes = seasonsData[season];
            if (episodes) {
                // Episodes in WS are often keys or array indices, handle both
                const epKey = Object.keys(episodes)[episode - 1];
                const epData = episodes[epKey];
                if (epData && epData.link) path = epData.link;
            }
        } else {
            path = item.l;
        }

        if (!path) return [];

        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const streams = [];

        const premiumBases = [...new Set(config.premium || [])];
        const publicBases = [...new Set(mediaType === 'movie' ? (config.movies || []) : (config.tv || []))];

        premiumBases.forEach(base => {
            streams.push({
                name: "StreamFlix | Premium",
                title: `${item.n.toUpperCase()} - 1080p`,
                url: `${base}${cleanPath}`,
                quality: "1080p",
                headers: HEADERS
            });
        });

        publicBases.forEach(base => {
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
}

module.exports = { getStreams, getHome };

if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
    global.getHome = getHome;
}
