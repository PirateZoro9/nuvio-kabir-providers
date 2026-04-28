/**
 * DudeFilms Production Provider for Nuvio (V3 - Final)
 * 
 * FIXED: 
 * - Multi-Step Redirection Logic (Finds 1080p/4K links correctly).
 * - Full Extractor Suite (GDFlix CF, BuzzServer, DriveBot, S3, Mega).
 * - Advanced Quality Normalization (Maps 4K, 2K, 1080p, 720p).
 * - Intelligent Title Matching (Handles 'Season X | Episode Y' formats).
 * - Nuvio Sandbox Optimized (High-speed, memory-safe).
 */

const cheerio = require('cheerio-without-node-native');

// --- Configuration & Constants ---
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const FALLBACK_MAIN_URL = "https://dudefilms.sarl";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
};

// --- State Management ---
let activeDomain = FALLBACK_MAIN_URL;
let lastSync = 0;

// --- Utilities ---

function base64Decode(str) {
    if (typeof atob !== 'undefined') return atob(str);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = String(str).replace(/=+$/, '');
    for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

function normalizeQuality(text) {
    const s = text.toLowerCase();
    if (/\b(4k|ds4k|uhd|2160p)\b/.test(s)) return "2160p";
    if (/\b(1440p|qhd|2k)\b/.test(s)) return "1440p";
    if (/\b(1080p|fullhd|fhd)\b/.test(s)) return "1080p";
    if (/\b(720p|hd)\b/.test(s)) return "720p";
    if (/\b(480p|sd|576p|540p)\b/.test(s)) return "480p";
    return "720p";
}

function calculateTitleSimilarity(title1, title2, year1, year2) {
    const normalize = (t) => t.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
    const t1 = normalize(title1);
    const t2 = normalize(title2);
    
    const set1 = new Set(t1.split(' '));
    const set2 = new Set(t2.split(' '));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    // We score based on how much of the query (set1) is present in the target title (set2)
    // because target titles on DudeFilms are often very long with extra tags (e.g., "[1080p] [Hindi Dubbed]").
    let score = intersection.size / set1.size;
    
    if (year1 && year2 && year1 === year2) {
        score += 0.2;
    }
    
    return score;
}

async function syncDomain() {
    const now = Date.now();
    if (now - lastSync < 3600000) return activeDomain;
    try {
        const res = await fetch(DOMAINS_URL);
        const data = await res.json();
        if (data.dudefilms) {
            activeDomain = data.dudefilms.replace(/\/$/, "");
            lastSync = now;
        }
    } catch (e) {}
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
        const jsRes = await fetch("https://gofile.io/dist/js/config.js", { headers: HEADERS });
        const jsText = await jsRes.text();
        const wtMatch = jsText.match(/appdata\.wt\s*=\s*["']([^"']+)["']/);
        if (!wtMatch) return [];
        const wt = wtMatch[1];
        const fileRes = await fetch(`https://api.gofile.io/contents/${id}?contentFilter=&page=1&pageSize=1000&sortField=name&sortDirection=1`, {
            headers: { ...HEADERS, "Authorization": `Bearer ${token}`, "X-Website-Token": wt }
        });
        const fileData = await fileRes.json();
        const children = fileData.data.children;
        return Object.values(children).filter(f => f.type === "file").map(fileObj => ({
            name: "DudeFilms | Gofile",
            title: `Gofile - ${fileObj.name}`,
            url: fileObj.link,
            quality: normalizeQuality(fileObj.name),
            headers: { "Cookie": `accountToken=${token}` }
        }));
    } catch (e) { return []; }
}

async function extractHubCloud(url, sourceTag = "HubCloud") {
    try {
        const res = await fetch(url, { headers: HEADERS });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        let downloadPage = "";
        if (url.includes('hubcloud.php')) {
            downloadPage = url;
        } else {
            const raw = $('#download').attr('href');
            if (raw) {
                if (raw.startsWith('http')) downloadPage = raw;
                else {
                    const uri = new URL(url);
                    downloadPage = `${uri.protocol}//${uri.host}/${raw.replace(/^\//, "")}`;
                }
            }
        }

        if (!downloadPage) return [];

        const res2 = await fetch(downloadPage, { headers: HEADERS });
        const html2 = await res2.text();
        const $2 = cheerio.load(html2);
        
        const fileName = $2('div.card-header').text() || $2('li:contains(Name)').text() || $2('h1').text() || "";
        const fileSize = $2('i#size').text() || $2('li:contains(Size)').text() || "";
        const fileQuality = normalizeQuality(fileName);
        const streams = [];
        const btnPromises = [];

        const labelExtras = `[${fileQuality}]${fileSize ? ` [${fileSize.replace(/Size\s*:\s*/i, "").trim()}]` : ""}`;

        $2('a.btn').each((_, el) => {
            const link = $2(el).attr('href');
            const text = $2(el).text().toLowerCase();
            if (!link) return;

            if (text.includes('fsl server') || text.includes('fslv2') || text.includes('pdl server') || text.includes('s3 server') || text.includes('mega server') || text.includes('download file')) {
                streams.push({
                    name: `DudeFilms | ${sourceTag}`,
                    title: `${text.toUpperCase().split('\n')[0].trim()} ${labelExtras}`,
                    url: link,
                    quality: fileQuality,
                    headers: HEADERS
                });
            } else if (text.includes('buzzserver')) {
                btnPromises.push((async () => {
                    try {
                        const bRes = await fetch(`${link}/download`, { headers: { ...HEADERS, "Referer": link }, redirect: 'manual' });
                        const dlink = bRes.headers.get('hx-redirect') || bRes.headers.get('HX-Redirect');
                        if (dlink) return { name: "DudeFilms | BuzzServer", title: `BuzzServer ${labelExtras}`, url: dlink, quality: fileQuality, headers: HEADERS };
                    } catch (e) {}
                    return null;
                })());
            } else if (text.includes('pixeldra') || text.includes('pixel server') || text.includes('pixelserver')) {
                const pxId = link.split('/').pop();
                streams.push({
                    name: "DudeFilms | PixelDrain",
                    title: `PixelDrain ${labelExtras}`,
                    url: `https://pixeldrain.com/api/file/${pxId}?download`,
                    quality: fileQuality,
                    headers: HEADERS
                });
            }
        });
        const extra = await Promise.all(btnPromises);
        return [...streams, ...extra.filter(Boolean)];
    } catch (e) { return []; }
}

async function extractGDFlix(url) {
    try {
        const res = await fetch(url, { headers: HEADERS });
        const html = await res.text();
        const $ = cheerio.load(html);
        const refresh = $('meta[http-equiv="refresh"]').attr('content');
        let targetUrl = url;
        if (refresh && refresh.includes('url=')) targetUrl = refresh.split('url=').pop();
        
        const res2 = await fetch(targetUrl, { headers: HEADERS });
        const html2 = await res2.text();
        const $2 = cheerio.load(html2);
        
        const fileName = $2('li.list-group-item:contains(Name)').text().replace(/Name\s*:\s*/i, "").trim() || $2('div.card-header').text() || "";
        const fileSize = $2('li.list-group-item:contains(Size)').text().replace(/Size\s*:\s*/i, "").trim() || "";
        const fileQuality = normalizeQuality(fileName);
        const streams = [];
        const btnPromises = [];

        $2('div.text-center a').each((_, el) => {
            const link = $2(el).attr('href');
            const label = $2(el).text().toLowerCase();
            if (!link || !link.startsWith('http')) return;

            if (label.includes('direct dl') || label.includes('instant dl')) {
                streams.push({
                    name: "DudeFilms | GDFlix",
                    title: `GD Direct [${fileSize}] - ${fileQuality}`,
                    url: link,
                    quality: fileQuality,
                    headers: HEADERS
                });
            } else if (label.includes('gofile')) {
                btnPromises.push(extractGofile(link));
            } else if (label.includes('pixeldrain') || label.includes('pixel')) {
                streams.push({ name: "DudeFilms | PixelDrain", title: `Pixel - ${fileQuality}`, url: link, quality: fileQuality, headers: HEADERS });
            }
        });

        // Cloudflare backup links
        ["type=1", "type=2"].forEach(t => {
            btnPromises.push((async () => {
                try {
                    const cfUrl = targetUrl.replace("/file/", "/wfile/") + (targetUrl.includes('?') ? "&" : "?") + t;
                    const cfRes = await fetch(cfUrl, { headers: HEADERS });
                    const cfHtml = await cfRes.text();
                    const cfLink = cheerio.load(cfHtml)('a.btn-success').attr('href');
                    if (cfLink) return { name: "DudeFilms | GDFlix CF", title: `CF Backup ${t} [${fileSize}] - ${fileQuality}`, url: cfLink, quality: fileQuality, headers: HEADERS };
                } catch (e) {}
                return null;
            })());
        });

        const extra = await Promise.all(btnPromises);
        return [...streams, ...extra.flat().filter(Boolean)];
    } catch (e) { return []; }
}

// --- Main Scraper ---

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        const domain = await syncDomain();
        
        // 1. Fetch metadata for better title matching
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${mediaType === 'movie' ? 'movie' : 'tv'}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`);
        const meta = await tmdbRes.json();
        const title = (meta.title || meta.name || "").toLowerCase();
        const year = (meta.release_date || meta.first_air_date || "").split('-')[0];

        // 2. Search
        const searchRes = await fetch(`${domain}/?s=${encodeURIComponent(title)}`, { headers: HEADERS });
        const searchHtml = await searchRes.text();
        const $s = cheerio.load(searchHtml);

        let postUrl = "";
        let bestScore = 0;
        
        $s('div.simple-grid-grid-post').each((_, el) => {
            const linkEl = $s(el).find('h3 a');
            const postTitle = linkEl.text();
            const href = linkEl.attr('href');
            
            // Extract a possible year from the title (e.g. "Matka King (2024)")
            const yearMatch = postTitle.match(/\((\d{4})\)/);
            const postYear = yearMatch ? yearMatch[1] : null;
            
            const score = calculateTitleSimilarity(title, postTitle, year, postYear);
            
            if (score > bestScore && score > 0.4) {
                bestScore = score;
                postUrl = href;
            }
        });

        if (!postUrl) return [];

        // 3. Post Page - Multi-Layer Drill Down
        const postRes = await fetch(postUrl, { headers: HEADERS });
        const postHtml = await postRes.text();
        const $p = cheerio.load(postHtml);

        const episodeUrls = [];

        if (mediaType === 'tv') {
            const seasonRegex = new RegExp(`Season\\s*0*${season}`, 'i');
            const epRegex = new RegExp(`(?:Episode|Ep|E)\\s*0*${episode}\\b`, 'i');
            
            const seasonButtons = [];

            $p('h4').each((_, el) => {
                if (seasonRegex.test($p(el).text())) {
                    let sibling = $p(el).next();
                    while (sibling.length && (sibling[0].name === 'p' || sibling[0].name === 'div')) {
                        sibling.find('a.maxbutton').each((__, btn) => {
                            const btnText = $p(btn).text().toLowerCase();
                            // Exclude blocked types
                            if (!['torrent', 'zip', 'rar', '7z'].some(t => btnText.includes(t))) {
                                const href = $p(btn).attr('href');
                                if (href) seasonButtons.push(href);
                            }
                        });
                        sibling = sibling.next();
                    }
                }
            });

            // If no season buttons found in specific block, fallback to all buttons that might be season links
            if (seasonButtons.length === 0) {
                $p('a.maxbutton').each((_, el) => {
                    const text = $p(el).text().toLowerCase();
                    if (seasonRegex.test(text) && !['torrent', 'zip', 'rar', '7z'].some(t => text.includes(t))) {
                        const href = $p(el).attr('href');
                        if (href) seasonButtons.push(href);
                    }
                });
            }

            // Drill down to Season Pages to find Episode Links
            await Promise.all([...new Set(seasonButtons)].map(async (sUrl) => {
                try {
                    const sRes = await fetch(sUrl, { headers: HEADERS });
                    const sHtml = await sRes.text();
                    const $season = cheerio.load(sHtml);
                    
                    $season('a.maxbutton-ep, a.maxbutton').each((_, epBtn) => {
                        const epText = $season(epBtn).text();
                        if (epRegex.test(epText) || epText.trim() === episode.toString()) {
                            const epUrl = $season(epBtn).attr('href');
                            if (epUrl) episodeUrls.push(epUrl);
                        }
                    });
                } catch (e) {}
            }));

        } else {
            // Movie logic
            $p('a.maxbutton').each((_, el) => {
                const href = $p(el).attr('href');
                const label = $p(el).text().toLowerCase();
                if (href && !['torrent', 'rar', 'zip', '7z'].some(t => label.includes(t))) {
                    episodeUrls.push(href);
                }
            });
        }

        if (episodeUrls.length === 0) return [];

        // 4. Extract from identified URLs
        const finalStreams = (await Promise.all([...new Set(episodeUrls)].map(async (u) => {
            // Recognize common domains
            if (u.includes('hubcloud') || u.includes('shikshakdaak.com')) return await extractHubCloud(u);
            if (u.includes('gdflix')) return await extractGDFlix(u);
            if (u.includes('gofile.io')) return await extractGofile(u);
            if (u.includes('pixeldrain')) {
                const pxId = u.split('/').pop();
                return [{ name: "DudeFilms | PixelDrain", title: "PixelDrain Direct", url: `https://pixeldrain.com/api/file/${pxId}?download`, quality: "HD", headers: HEADERS }];
            }
            if (u.includes('hubcdn')) {
                try {
                    const r = await fetch(u, { headers: HEADERS });
                    const h = await r.text();
                    const enc = h.match(/r=([A-Za-z0-9+/=]+)/);
                    if (enc) {
                        const m3u8 = base64Decode(enc[1]).split('link=').pop();
                        return [{ name: "DudeFilms | HubCDN", title: "Direct Stream", url: m3u8, quality: "720p", headers: { "Referer": u } }];
                    }
                } catch (e) {}
            }
            
            // Generic fallback for unknown redirectors
            try {
                const r = await fetch(u, { headers: HEADERS });
                const h = await r.text();
                const $d = cheerio.load(h);
                const subLinks = [];
                $d('a.maxbutton').each((__, el) => {
                    const l = $d(el).attr('href');
                    if (l && (l.includes('hubcloud') || l.includes('gdflix') || l.includes('gofile'))) subLinks.push(l);
                });
                if (subLinks.length > 0) {
                    const results = await Promise.all(subLinks.map(sl => {
                        if (sl.includes('hubcloud')) return extractHubCloud(sl);
                        if (sl.includes('gdflix')) return extractGDFlix(sl);
                        if (sl.includes('gofile')) return extractGofile(sl);
                        return [];
                    }));
                    return results.flat();
                }
            } catch (e) {}
            return [];
        }))).flat().filter(s => s && s.url);

        const unique = [];
        const seen = new Set();
        finalStreams.forEach(s => {
            if (!seen.has(s.url)) {
                seen.add(s.url);
                if (s.url.includes('m3u8')) s.isHLS = true;
                if (!s.url.includes('.') && !s.url.includes('?')) s.url += "#.m3u8";
                unique.push(s);
            }
        });
        return unique;
    } catch (e) {
        console.error(`[DudeFilms] Fatal Error: ${e.message}`);
        return [];
    }
}

module.exports = { getStreams };

if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
}
