/**
 * DoFlix Production Provider for Nuvio
 * 
 * FIXED: Removed 'setTimeout' (not supported in this sandbox).
 * Features:
 * - Home Screen (Catalogs) support.
 * - Direct TMDB ID Mapping.
 * - Quality normalization.
 */

const cheerio = require('cheerio-without-node-native');

// --- Configuration ---
const MAIN_URL = "https://panel.watchkaroabhi.com";
const API_KEY = process.env.DOFLIX_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500/";

const HEADERS = {
    "Connection": "Keep-Alive",
    "User-Agent": "dooflix",
    "X-App-Version": "305",
    "X-Package-Name": "com.king.moja",
    "Accept": "application/json"
};

const STREAM_HEADERS = {
    "Referer": "https://molop.art/",
    "User-Agent": "dooflix"
};

// --- Networking Layer ---

async function request(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: { ...HEADERS, ...options.headers }
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return await response.json();
    } catch (e) {
        throw e;
    }
}

// --- Utilities ---

function normalizeQuality(q) {
    if (!q) return "720p";
    const quality = q.toUpperCase();
    if (quality.includes("4K") || quality.includes("2160")) return "2160p";
    if (quality.includes("FHD") || quality.includes("1080")) return "1080p";
    if (quality.includes("HD") || quality.includes("720")) return "720p";
    if (quality.includes("SD") || quality.includes("480")) return "480p";
    return "720p";
}

// --- Home Logic ---

async function getHome(cb) {
    const categories = [
        { name: "Recent Movies", url: `${MAIN_URL}/api/3/discover/movie?api_key=${API_KEY}&language=en&sort_by=primary_release_date.desc&page=1` },
        { name: "Recent Series", url: `${MAIN_URL}/api/3/discover/tv?api_key=${API_KEY}&language=en&sort_by=first_air_date.desc&page=1` },
        { name: "Trending Movies", url: `${MAIN_URL}/api/3/trending/movie/week?api_key=${API_KEY}&page=1` },
        { name: "Trending Series", url: `${MAIN_URL}/api/3/trending/tv/week?api_key=${API_KEY}&page=1` }
    ];

    try {
        const homeData = {};
        const results = await Promise.all(
            categories.map(cat => request(cat.url).catch(() => ({ results: [] })))
        );

        categories.forEach((cat, i) => {
            const items = results[i].results || [];
            if (items.length > 0) {
                homeData[cat.name] = items.slice(0, 15).map(item => ({
                    title: item.title || item.name || "Unknown",
                    url: item.id.toString(),
                    posterUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path.replace(/^\/+/, "")}` : null,
                    type: item.first_air_date || item.name ? "series" : "movie",
                    score: parseFloat(item.vote_average) || 0
                }));
            }
        });

        cb({ success: true, data: homeData });
    } catch (e) {
        cb({ success: false, message: e.message });
    }
}

// --- Stream Logic ---

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[DoFlix] Request: ${mediaType} ${tmdbId}`);

        let linksUrl = "";
        if (mediaType === 'movie') {
            linksUrl = `${MAIN_URL}/api/3/movie/${tmdbId}/links?api_key=${API_KEY}`;
        } else {
            linksUrl = `${MAIN_URL}/api/3/tv/${tmdbId}/season/${season}/episode/${episode}/links?api_key=${API_KEY}`;
        }

        const data = await request(linksUrl);
        const linksArray = mediaType === 'movie' ? data.links : data.results;

        if (!linksArray || !Array.isArray(linksArray)) return [];

        const streams = linksArray.map(link => {
            if (!link.url) return null;
            const quality = normalizeQuality(link.quality);
            const host = link.host || "DoFlix";
            const finalUrl = link.url.includes('.m3u8') ? link.url : `${link.url}#.m3u8`;

            return {
                name: `DoFlix | ${host}`,
                title: `${host} - ${quality}`,
                url: finalUrl,
                quality: quality,
                headers: STREAM_HEADERS
            };
        }).filter(Boolean);

        return streams;
    } catch (e) {
        console.error(`[DoFlix] Stream Error: ${e.message}`);
        return [];
    }
}

module.exports = { getStreams, getHome };

if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
    global.getHome = getHome;
}
