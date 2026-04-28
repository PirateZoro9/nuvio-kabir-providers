/**
 * SFlix Provider for Nuvio
 * Complete implementation of the BFF (Backend for Frontend) API.
 * Version: 1.0.1 - FIXED: Strict title and year matching
 */

const cheerio = require('cheerio-without-node-native');

// --- Configuration & Constants ---
const BASE_URL = "https://sflix.film";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

/**
 * Endpoints derived from SFlix BFF architecture
 */
const ENDPOINTS = {
    SEARCH: "/wefeed-h5-bff/web/subject/search",
    DETAIL: "/wefeed-h5-bff/web/subject/detail",
    PLAY: "/wefeed-h5-bff/web/subject/play",
    CAPTION: "/wefeed-h5-bff/web/subject/caption",
    RANKING: "/wefeed-h5-bff/web/ranking-list/content"
};

/**
 * Mandatory headers for BFF authentication
 */
const GLOBAL_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": BASE_URL,
    "Referer": `${BASE_URL}/`
};

// --- Networking Layer ---

async function bffRequest(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : BASE_URL + endpoint;
    const method = options.method || "GET";
    const headers = Object.assign({}, GLOBAL_HEADERS, options.headers || {});
    
    if (method === "POST" && options.body) {
        headers["Content-Type"] = "application/json;charset=UTF-8";
    }

    const response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) throw new Error(`BFF Request Failed: ${response.status}`);
    const json = await response.json();
    if (json.code !== 0) throw new Error(`BFF Logic Error: ${json.message}`);
    return json.data;
}

// --- Domain Helpers ---

async function getTMDBInfo(tmdbId, mediaType) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    const url = `${TMDB_BASE}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return {
        title: mediaType === 'movie' ? data.title : data.name,
        originalTitle: mediaType === 'movie' ? data.original_title : data.original_name,
        year: (mediaType === 'movie' ? data.release_date : data.first_air_date)?.split('-')[0] || ""
    };
}

function formatQuality(res) {
    if (!res) return "Auto";
    const str = String(res);
    return str.endsWith('p') ? str : str + 'p';
}

function uniqueStreams(streams) {
    const seen = new Set();
    return streams.filter(s => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

// --- BFF API Wrappers ---

async function searchSFlix(query) {
    const body = {
        keyword: query,
        page: 1,
        perPage: 24,
        subjectType: 0
    };
    const data = await bffRequest(ENDPOINTS.SEARCH, { method: "POST", body });
    return data?.items || [];
}

async function loadDetail(subjectId) {
    const endpoint = `${ENDPOINTS.DETAIL}?subjectId=${subjectId}`;
    const data = await bffRequest(endpoint);
    if (!data?.subject) throw new Error("Metadata not found");
    
    const subject = data.subject;
    const resource = data.resource;
    const episodes = [];
    const isSeries = subject.subjectType === 2;

    if (isSeries && resource?.seasons) {
        resource.seasons.forEach(season => {
            const epNums = season.allEp 
                ? season.allEp.split(',').map(Number) 
                : Array.from({length: season.maxEp}, (_, i) => i + 1);
                
            epNums.forEach(num => {
                episodes.push({
                    name: `Episode ${num}`,
                    season: season.se,
                    episode: num,
                    id: subject.subjectId,
                    path: subject.detailPath
                });
            });
        });
    } else {
        episodes.push({
            name: "Movie",
            season: 0,
            episode: 0,
            id: subject.subjectId,
            path: subject.detailPath
        });
    }
    return { subject, episodes };
}

async function fetchSubtitles(streamId, format, subjectId, path) {
    try {
        const refererUrl = `${BASE_URL}/spa/videoPlayPage/movies/${path}?id=${subjectId}&type=/movie/detail&lang=en`;
        const endpoint = `${ENDPOINTS.CAPTION}?format=${format}&id=${streamId}&subjectId=${subjectId}`;
        const data = await bffRequest(endpoint, { headers: { "Referer": refererUrl } });
        if (data?.captions) {
            return data.captions.map(sub => ({
                url: sub.url,
                label: sub.lanName || sub.lan || "Unknown",
                lang: sub.lanName || sub.lan || "Unknown"
            })).filter(sub => sub.url);
        }
    } catch (e) {}
    return [];
}

async function resolvePlayInfo(id, se, ep, path) {
    const refererUrl = `${BASE_URL}/spa/videoPlayPage/movies/${path}?id=${id}&type=/movie/detail&lang=en`;
    const endpoint = `${ENDPOINTS.PLAY}?subjectId=${id}&se=${se}&ep=${ep}`;
    const data = await bffRequest(endpoint, { headers: { "Referer": refererUrl } });

    if (!data?.streams || data.streams.length === 0) return [];
    const subtitles = await fetchSubtitles(data.streams[0].id, data.streams[0].format, id, path);

    const streamResults = data.streams
        .reverse()
        .map(s => ({
            name: "SFlix (BFF)",
            title: `SFlix - ${formatQuality(s.resolutions)}`,
            url: s.url,
            quality: formatQuality(s.resolutions),
            headers: { "Referer": `${BASE_URL}/` },
            subtitles: subtitles
        }));

    return uniqueStreams(streamResults);
}

/**
 * Main function with STRICT MATCHING
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[SFlix] Request: ${mediaType} ${tmdbId} S:${season} E:${episode}`);

        // 1. Resolve exact title and year from TMDB
        const info = await getTMDBInfo(tmdbId, mediaType);
        if (!info.title) return [];
        
        const targetTitle = info.title.toLowerCase();
        const originalTitle = info.originalTitle?.toLowerCase() || "";
        const targetYear = info.year;

        // 2. Search SFlix
        const searchResults = await searchSFlix(info.title);
        
        // 3. STRICT MATCHING: Filter by Title Similarity and Release Year
        const match = searchResults.find(r => {
            const rTitle = r.title.toLowerCase();
            const rYear = r.releaseDate?.split('-')[0] || "";
            
            const isTitleMatch = rTitle === targetTitle || rTitle === originalTitle || rTitle.includes(targetTitle);
            const isYearMatch = rYear === targetYear;

            // Must match title and be within 1 year of the target release (to handle slight DB mismatches)
            return isTitleMatch && (isYearMatch || Math.abs(parseInt(rYear) - parseInt(targetYear)) <= 1);
        });

        if (!match) {
            console.warn(`[SFlix] No strict match found for ${info.title} (${info.year})`);
            return [];
        }

        console.log(`[SFlix] Strict Match Found: ${match.title} (${match.releaseDate})`);

        // 4. Get detailed metadata and episode IDs
        const detail = await loadDetail(match.subjectId);
        
        // 5. Find the target episode
        let target = null;
        if (mediaType === 'movie') {
            target = detail.episodes[0];
        } else {
            target = detail.episodes.find(e => e.season == season && e.episode == episode);
        }

        if (!target) return [];

        // 6. Resolve final stream and subtitles
        return await resolvePlayInfo(target.id, target.season, target.episode, target.path);

    } catch (error) {
        console.error(`[SFlix] Fatal Error: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
