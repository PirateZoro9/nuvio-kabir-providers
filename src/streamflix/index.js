/**
 * StreamFlix Production Provider for Nuvio
 * 
 * Features:
 * - Direct Bridge to StreamFlix API (data.json).
 * - Firebase WebSocket implementation for TV Show episode fetching.
 * - Dynamic Mirror Resolution.
 * - Home Screen (Catalog) support.
 * - Subtitle support (if embedded in HLS).
 * 
 * Ported by Kabir for Nuvio.
 */

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
        const res = await fetch(`${MAIN_URL}/data.json`, { headers: HEADERS });
        const json = await res.json();
        if (json && json.data) {
            cachedData = json.data.filter(i => i.moviename && i.moviekey);
            lastSync = now;
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
        cachedConfig = await res.json();
        return cachedConfig;
    } catch (e) {
        return { premium: [], movies: [], tv: [] };
    }
}

// --- WebSocket Logic for TV Shows ---

async function getEpisodesFromWS(movieKey, totalSeasons = 1) {
    // Note: Since we are in a sandbox, we check if global WebSocket is available.
    // If not, we fallback to an error or manual construction if possible.
    if (typeof WebSocket === 'undefined') {
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
        }, 10000);

        ws.onopen = () => {
            for (let s = 1; s <= totalSeasons; s++) {
                ws.send(JSON.stringify({
                    t: "d",
                    d: { a: "q", r: s, b: { p: `Data/${movieKey}/seasons/${s}/episodes`, h: "" } }
                }));
            }
        };

        ws.onmessage = (event) => {
            if (isResolved) return;
            const text = event.data;
            if (/^\d+$/.test(text.trim())) return;

            try {
                const json = JSON.parse(text);
                if (json.t === 'd' && json.d) {
                    const b = json.d.b;
                    if (b && b.s === 'ok') {
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
                        if (!seasonsData[sNum]) seasonsData[sNum] = {};
                        Object.keys(b.d).forEach(k => seasonsData[sNum][k] = b.d[k]);
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

function mapItem(item) {
    const poster = item.movieposter ? String(item.movieposter).replace(/^\/+/, "") : "";
    return {
        title: item.moviename,
        url: `sf_${item.moviekey}`,
        posterUrl: poster ? `${TMDB_IMAGE_BASE}${poster}` : null,
        type: item.isTV ? "series" : "movie"
    };
}

// --- Main Extraction Logic ---

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[StreamFlix] Request: ${mediaType} ${tmdbId}`);
        const data = await syncData();
        const config = await getConfig();

        // 1. Resolve Item from data.json
        // Try direct TMDB match or search
        let item = data.find(i => i.tmdb === tmdbId || i.movieimdb?.includes(tmdbId));
        
        // Fallback: Title match via TMDB API if tmdbId is numeric
        if (!item && /^\d+$/.test(tmdbId)) {
            const tmdbType = mediaType === 'movie' ? 'movie' : 'tv';
            const res = await fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`);
            const meta = await res.json();
            const title = (meta.title || meta.name || "").toLowerCase();
            if (title) {
                item = data.find(i => i.moviename?.toLowerCase() === title);
            }
        }

        if (!item) return [];

        let path = "";

        if (item.isTV) {
            if (!season || !episode) return [];
            // TV links are retrieved from WebSocket
            const seasonsData = await getEpisodesFromWS(item.moviekey, season);
            const epData = seasonsData[season]?.[episode - 1]; // episodes are 0-indexed in WS
            if (epData && epData.link) path = epData.link;
        } else {
            path = item.movielink;
        }

        if (!path) return [];

        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const streams = [];

        // Build stream objects from mirror config
        const premiumBases = [...new Set(config.premium || [])];
        const publicBases = [...new Set(mediaType === 'movie' ? (config.movies || []) : (config.tv || []))];

        premiumBases.forEach(base => {
            streams.push({
                name: "StreamFlix | Premium",
                title: `${item.moviename} - 1080p`,
                url: `${base}${cleanPath}`,
                quality: "1080p",
                headers: HEADERS
            });
        });

        publicBases.forEach(base => {
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
}

// --- Exports ---

module.exports = { getStreams, getHome };

if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
    global.getHome = getHome;
}
