/**
 * SFlix Provider for Nuvio
 * Complete implementation of the BFF (Backend for Frontend) API.
 * Optimized with Universal Proxy for Global Access.
 */

const cheerio = require('cheerio-without-node-native');

// --- Configuration & Constants ---
const BASE_URL = "https://sflix.film";
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

// Universal Proxy URL (Shared with StreamFlix)
const PROXY_URL = "https://script.google.com/macros/s/AKfycbzKvHoxL0rV7PGsti4EN0oNMoiFmizAmipZ2R_ZoCQeIyAC_xeXVBeI2vB2GDa4fGIYYg/exec";

/**
 * Networking Layer (Universal Proxy Routing)
 */
async function bffRequest(action, params = {}) {
    try {
        let queryParts = [`action=${action}`];
        for (let key in params) {
            queryParts.push(`${key}=${encodeURIComponent(params[key])}`);
        }
        
        const proxyUrl = `${PROXY_URL}?${queryParts.join("&")}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) throw new Error(`Proxy Request Failed: ${response.status}`);
        const json = await response.json();
        
        // SFlix BFF uses code 0 for success
        if (json.code !== 0) throw new Error(`BFF Logic Error: ${json.message || "Unknown error"}`);
        return json.data;
    } catch (e) {
        console.error(`[SFlix Proxy] Error: ${e.message}`);
        throw e;
    }
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

// --- API Wrappers (Now using Proxy) ---

async function searchSFlix(query) {
    const data = await bffRequest("sflix_search", { q: query });
    return data?.items || [];
}

async function loadDetail(subjectId) {
    const data = await bffRequest("sflix_detail", { id: subjectId });
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
        const data = await bffRequest("sflix_caption", { 
            format: format, 
            id: streamId, 
            sid: subjectId,
            referer: refererUrl
        });
        
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
    const data = await bffRequest("sflix_play", { 
        id: id, 
        se: se, 
        ep: ep,
        referer: refererUrl
    });

    if (!data?.streams || data.streams.length === 0) return [];
    const subtitles = await fetchSubtitles(data.streams[0].id, data.streams[0].format, id, path);

    const streamResults = data.streams
        .reverse()
        .map(s => ({
            name: "SFlix (Global)",
            title: `SFlix - ${formatQuality(s.resolutions)}`,
            url: s.url,
            quality: formatQuality(s.resolutions),
            headers: { "Referer": `${BASE_URL}/` },
            subtitles: subtitles
        }));

    return uniqueStreams(streamResults);
}

/**
 * Main Entry Point
 */
async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        console.log(`[SFlix] Request: ${mediaType} ${tmdbId} S:${season} E:${episode}`);

        const info = await getTMDBInfo(tmdbId, mediaType);
        if (!info.title) return [];
        
        const targetTitle = info.title.toLowerCase();
        const originalTitle = info.originalTitle?.toLowerCase() || "";
        const targetYear = info.year;

        const searchResults = await searchSFlix(info.title);
        
        const match = searchResults.find(r => {
            const rTitle = r.title.toLowerCase();
            const rYear = r.releaseDate?.split('-')[0] || "";
            const isTitleMatch = rTitle === targetTitle || rTitle === originalTitle || rTitle.includes(targetTitle);
            const isYearMatch = rYear === targetYear;
            return isTitleMatch && (isYearMatch || Math.abs(parseInt(rYear) - parseInt(targetYear)) <= 1);
        });

        if (!match) {
            console.warn(`[SFlix] No strict match found for ${info.title} (${info.year})`);
            return [];
        }

        const detail = await loadDetail(match.subjectId);
        let target = null;
        if (mediaType === 'movie') {
            target = detail.episodes[0];
        } else {
            target = detail.episodes.find(e => e.season == season && e.episode == episode);
        }

        if (!target) return [];

        return await resolvePlayInfo(target.id, target.season, target.episode, target.path);

    } catch (error) {
        console.error(`[SFlix] Fatal Error: ${error.message}`);
        return [];
    }
}

module.exports = { getStreams };
