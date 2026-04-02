/**
 * DoFlix Provider for Nuvio
 * ported from SaurabhKaperwanCSX ported by kabir
 */

const MAIN_URL = "https://panel.watchkaroabhi.com";
const API_KEY = "qNhKLJiZVyoKdi9NCQGz8CIGrpUijujE";

const HEADERS = {
    "Connection": "Keep-Alive",
    "User-Agent": "dooflix",
    "X-App-Version": "305",
    "X-Package-Name": "com.king.moja",
    "Accept": "application/json"
};

/**
 * Format quality string to Nuvio standard
 */
function normalizeQuality(qualityString) {
    if (!qualityString) return "Unknown";
    const q = qualityString.toUpperCase();
    if (q === "4K" || q === "2160P") return "2160p";
    if (q === "FHD" || q === "1080P") return "1080p";
    if (q === "HD" || q === "720P") return "720p";
    if (q === "SD" || q === "480P") return "480p";
    if (q === "360P") return "360p";
    return q;
}

/**
 * Main function called by Nuvio
 */
async function getStreams(tmdbId, mediaType = 'movie', season = null, episode = null) {
    try {
        let linksUrl = "";

        // DoFlix conveniently proxies TMDB and uses TMDB IDs natively for its links endpoint!
        if (mediaType === 'movie') {
            linksUrl = `${MAIN_URL}/api/3/movie/${tmdbId}/links?api_key=${API_KEY}`;
        } else if (mediaType === 'tv') {
            if (!season || !episode) return [];
            linksUrl = `${MAIN_URL}/api/3/tv/${tmdbId}/season/${season}/episode/${episode}/links?api_key=${API_KEY}`;
        } else {
            return [];
        }

        const response = await fetch(linksUrl, { method: "GET", headers: HEADERS });
        
        if (!response.ok) {
            console.error(`[DoFlix] API Error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        
        // The API returns an array of link objects in 'links' (for movies) or 'results' (for series)
        const linksArray = mediaType === 'movie' ? data.links : data.results;

        if (!linksArray || !Array.isArray(linksArray)) {
            return [];
        }

        const streams = [];

        linksArray.forEach(linkObj => {
            if (linkObj && linkObj.url) {
                const host = linkObj.host || "DoFlix Stream";
                const rawQuality = linkObj.quality || "Auto";
                const finalQuality = normalizeQuality(rawQuality);
                
                // M3U8 is the standard return type according to the Kotlin plugin
                streams.push({
                    name: "DoFlix",
                    title: `${host} - ${finalQuality}`,
                    url: linkObj.url,
                    quality: finalQuality,
                    // The Kotlin code uses this specific referer for video playback
                    headers: {
                        "Referer": "https://molop.art/" 
                    }
                });
            }
        });

        return streams;
    } catch (e) {
        console.error("[DoFlix] getStreams error:", e.message);
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = { getStreams };
}
