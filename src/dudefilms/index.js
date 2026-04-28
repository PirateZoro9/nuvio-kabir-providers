/**
 * DudeFilms Production Provider for Nuvio
 * 
 * Features:
 * - Dynamic Domain Rotation (Dead-drop GitHub sync).
 * - Recursive Button Scraper (Parallelized).
 * - Built-in HubCloud, GDFlix, and Gofile Extractors.
 * - Sandbox Safe (No Buffer, No Timers).
 */

const cheerio = require('cheerio-without-node-native');

// --- Configuration & Constants ---
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const GDFLIX_JSON = "https://raw.githubusercontent.com/SaurabhKaperwan/Utils/refs/heads/main/urls.json";
const FALLBACK_MAIN_URL = "https://dudefilms.sarl";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
};

// --- State Management ---
let activeDomain = FALLBACK_MAIN_URL;
let lastSync = 0;

// --- Utilities ---

/**
 * Base64 Decode Polyfill for Hermes Sandbox
 */
function base64Decode(str) {
    if (typeof atob !== 'undefined') return atob(str);
    // Simple fallback if atob is missing (unlikely in Nuvio but safe)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = String(str).replace(/=+$/, '');
    for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

async function syncDomain() {
    const now = Date.now();
    if (now - lastSync < 3600000) return activeDomain;

    try {
        console.log("[DudeFilms] Syncing domain...");
        const res = await fetch(DOMAINS_URL);
        const data = await res.json();
        if (data.dudefilms) {
            activeDomain = data.dudefilms.replace(/\/$/, "");
            lastSync = now;
        }
    } catch (e) {
        console.error(`[DudeFilms] Domain sync failed: ${e.message}`);
    }
    return activeDomain;
}

// --- Extractors ---

async function extractGofile(url) {
    try {
        const idMatch = url.match(/\/(?:\?c=|d\/)([\da-zA-Z-]+)/);
        if (!idMatch) return [];
        const id = idMatch[1];

        const acctRes = await fetch("https://api.gofile.io/accounts", { method: 'POST', headers: HEADERS });
        const acctData = await acctRes.json();
        const token = acctData.data.token;

        const jsRes = await fetch("https://gofile.io/dist/js/global.js", { headers: HEADERS });
        const jsText = await jsRes.text();
        const wtMatch = jsText.match(/appdata\.wt\s*=\s*["']([^"']+)["']/);
        if (!wtMatch) return [];
        const wt = wtMatch[1];

        const fileRes = await fetch(`https://api.gofile.io/contents/${id}?wt=${wt}`, {
            headers: { ...HEADERS, "Authorization": `Bearer ${token}` }
        });
        const fileData = await fileRes.json();
        const children = fileData.data.children;
        const firstFileId = Object.keys(children)[0];
        const fileObj = children[firstFileId];

        return [{
            name: "Gofile",
            title: `Gofile - ${fileObj.name || 'Direct'}`,
            url: fileObj.link,
            quality: "HD",
            headers: { "Cookie": `accountToken=${token}` }
        }];
    } catch (e) { return []; }
}

async function extractHubCloud(url) {
    try {
        const res = await fetch(url, { headers: HEADERS });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        let downloadPage = $('#download').attr('href');
        if (!downloadPage) return [];
        
        if (!downloadPage.startsWith('http')) {
            const uri = new URL(url);
            downloadPage = `${uri.protocol}//${uri.host}/${downloadPage.replace(/^\//, "")}`;
        }

        const res2 = await fetch(downloadPage, { headers: HEADERS });
        const html2 = await res2.text();
        const $2 = cheerio.load(html2);
        const streams = [];

        $2('a.btn').each((_, el) => {
            const link = $2(el).attr('href');
            const label = $2(el).text().toLowerCase();
            if (!link) return;

            if (label.includes('fsl server')) {
                streams.push({
                    name: "DudeFilms | FSL Server",
                    title: `HubCloud - ${label.includes('1080') ? '1080p' : '720p'}`,
                    url: link,
                    quality: label.includes('1080') ? '1080p' : '720p',
                    headers: HEADERS
                });
            }
        });
        return streams;
    } catch (e) { return []; }
}

// --- Main Scraper ---

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const domain = await syncDomain();
        console.log(`[DudeFilms] Request: ${mediaType} ${tmdbId}`);

        // 1. Get Title via TMDB
        const tmdbType = mediaType === 'movie' ? 'movie' : 'tv';
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`);
        const meta = await tmdbRes.json();
        const title = (meta.title || meta.name || "").toLowerCase();

        // 2. Search on Website
        const searchUrl = `${domain}/?s=${encodeURIComponent(title)}`;
        const searchRes = await fetch(searchUrl, { headers: HEADERS });
        const searchHtml = await searchRes.text();
        const $ = cheerio.load(searchHtml);

        let postUrl = "";
        $('div.simple-grid-grid-post').each((_, el) => {
            const h3 = $(el).find('h3 a');
            const postTitle = h3.text().toLowerCase();
            const href = h3.attr('href');
            if (postTitle.includes(title)) {
                postUrl = href;
            }
        });

        if (!postUrl) return [];

        // 3. Load Post and Find Buttons
        const postRes = await fetch(postUrl, { headers: HEADERS });
        const postHtml = await postRes.text();
        const $post = cheerio.load(postHtml);

        const buttonUrls = [];
        $post('a.maxbutton').each((_, el) => {
            const href = $post(el).attr('href');
            const text = $post(el).text().toLowerCase();
            if (href && !['zipfile', 'torrent', 'rar', '7z'].some(t => text.includes(t))) {
                buttonUrls.push(href);
            }
        });

        // 4. Follow buttons to find Server pages
        const serverPagePromises = buttonUrls.map(async (u) => {
            try {
                const r = await fetch(u, { headers: HEADERS });
                const h = await r.text();
                const $$ = cheerio.load(h);
                const links = [];
                $$('a.maxbutton, a.maxbutton-ep').each((__, el) => {
                    const link = $$(el).attr('href');
                    const text = $$(el).text().toLowerCase();
                    if (link) {
                        if (mediaType === 'tv') {
                            if (text.includes(`episode ${episode}`) || text.includes(`ep ${episode}`) || text === episode.toString()) {
                                links.push(link);
                            }
                        } else {
                            links.push(link);
                        }
                    }
                });
                return links;
            } catch (e) { return []; }
        });

        const allServerUrls = (await Promise.all(serverPagePromises)).flat();
        
        // 5. Extract streams from Server URLs
        const streamPromises = allServerUrls.map(async (u) => {
            if (u.includes('hubcloud')) return await extractHubCloud(u);
            if (u.includes('gofile.io')) return await extractGofile(u);
            // HubCDN logic
            if (u.includes('hubcdn')) {
                try {
                    const r = await fetch(u, { headers: HEADERS });
                    const h = await r.text();
                    const enc = h.match(/r=([A-Za-z0-9+/=]+)/);
                    if (enc) {
                        const dec = base64Decode(enc[1]);
                        const final = dec.split('link=').pop();
                        return [{ name: "DudeFilms | HubCDN", title: "Direct Stream", url: final, quality: "720p", headers: { "Referer": u } }];
                    }
                } catch (e) {}
            }
            return [];
        });

        const results = (await Promise.all(streamPromises)).flat().filter(s => s && s.url);

        // Normalize URLs (ExoPlayer force HLS)
        return results.map(s => {
            if (!s.url.includes('.') && !s.url.includes('?')) {
                s.url += "#.m3u8";
            }
            return s;
        });

    } catch (e) {
        console.error(`[DudeFilms] Fatal Error: ${e.message}`);
        return [];
    }
}

module.exports = { getStreams };

if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
}
