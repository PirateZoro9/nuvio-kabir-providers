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

module.exports = { getStreams };

if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
}
