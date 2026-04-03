/**
 * CineStream
 * Ported from SaurabhKaperwan/CSX, ported by kabir
 */
const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const ANILIST_API = 'https://graphql.anilist.co';
const MALSYNC_API = 'https://api.malsync.moe';

const STREMIO_PROVIDERS = [
    { id: 'webstreamr', name: 'WebStreamr', url: 'https://webstreamr.hayd.uk/{"multi":"on","hi":"on","showErrors":"on","includeExternalUrls":"on","mediaFlowProxyUrl":"","mediaFlowProxyPassword":""}' },
    { id: 'streamvix', name: 'Streamvix', url: 'https://streamvix.hayd.uk' },
];

const ANIME_STREMIO_PROVIDERS = [
    { id: 'animeworld', name: 'AnimeWorld', url: 'https://anime-world-stremio-addon.onrender.com' },
];

const HIANIME_APIS = [
    'https://hianimez.is',
    'https://hianimez.to',
    'https://hianime.nz',
    'https://hianime.bz',
    'https://hianime.pe',
];

const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
};

const AJAX_HEADERS = {
    'X-Requested-With': 'XMLHttpRequest',
    Referer: 'https://hianime.to/',
    'User-Agent': 'Mozilla/5.0',
};

function fetchText(url, options) {
    return fetch(url, {
        headers: Object.assign({}, COMMON_HEADERS, options && options.headers ? options.headers : {}),
        method: options && options.method ? options.method : 'GET',
        body: options && options.body ? options.body : undefined,
    }).then(function (res) {
        if (!res.ok) {
            throw new Error('HTTP ' + res.status + ' for ' + url);
        }
        return res.text();
    });
}

function fetchJson(url, options) {
    return fetchText(url, options).then(function (text) {
        return JSON.parse(text);
    });
}

function getTmdbInfo(tmdbId, mediaType) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    const url = TMDB_BASE_URL + '/' + type + '/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&append_to_response=external_ids';
    return fetchJson(url).then(function (data) {
        return {
            tmdbId: tmdbId,
            mediaType: type,
            imdbId: data && data.external_ids ? data.external_ids.imdb_id : null,
            title: type === 'movie' ? data.title : data.name,
            originalTitle: type === 'movie' ? data.original_title : data.original_name,
            year: ((type === 'movie' ? data.release_date : data.first_air_date) || '').split('-')[0] || null,
            firstAirDate: type === 'tv' ? data.first_air_date : null,
        };
    });
}

function getTmdbSeasonAirDate(tmdbId, season) {
    const url = TMDB_BASE_URL + '/tv/' + tmdbId + '/season/' + season + '?api_key=' + TMDB_API_KEY;
    return fetchJson(url).then(function (data) {
        return data && data.air_date ? data.air_date : null;
    }).catch(function () {
        return null;
    });
}

function qualityFromText(value) {
    const text = String(value || '');
    const match = text.match(/\b(2160|1440|1080|720|576|540|480|360)p\b/i);
    if (match) return match[1] + 'p';
    if (/4k/i.test(text)) return '4K';
    if (/cam/i.test(text)) return 'CAM';
    return 'Auto';
}

function normalizeSubtitles(input) {
    if (!Array.isArray(input)) return [];
    return input.map(function (item) {
        return {
            label: item.lang || item.label || item.language || 'Unknown',
            url: item.url || item.file || '',
        };
    }).filter(function (item) {
        return item.url;
    });
}

function mapStremioStreams(providerName, payload) {
    const streams = payload && Array.isArray(payload.streams) ? payload.streams : [];
    return streams.map(function (stream) {
        const requestHeaders = stream && stream.behaviorHints && stream.behaviorHints.proxyHeaders
            ? stream.behaviorHints.proxyHeaders.request
            : null;
        const subtitleHints = stream && stream.behaviorHints && Array.isArray(stream.behaviorHints.subtitles)
            ? stream.behaviorHints.subtitles
            : [];
        const title = String(stream.title || stream.name || providerName);
        const inferredName = String(stream.name || providerName).split('|').pop().trim();
        return {
            name: providerName + ' [' + inferredName + ']',
            title: title.split('\n')[0],
            url: stream.url,
            quality: qualityFromText(title),
            headers: requestHeaders || { Referer: providerName },
            subtitles: normalizeSubtitles(subtitleHints),
        };
    }).filter(function (stream) {
        return !!stream.url;
    });
}

function invokeStremioStreams(provider, mediaInfo, season, episode) {
    if (!mediaInfo.imdbId) return Promise.resolve([]);
    const path = mediaInfo.mediaType === 'movie'
        ? '/stream/movie/' + mediaInfo.imdbId + '.json'
        : '/stream/series/' + mediaInfo.imdbId + ':' + season + ':' + episode + '.json';
    return fetchJson(provider.url + path).then(function (payload) {
        return mapStremioStreams(provider.name, payload);
    }).catch(function () {
        return [];
    });
}

function tmdbToAnimeId(title, year) {
    if (!title || !year) return Promise.resolve({ idMal: null });
    return fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': COMMON_HEADERS['User-Agent'],
        },
        body: JSON.stringify({
            query: 'query ($search: String, $seasonYear: Int) { Page(perPage: 5) { media(search: $search, seasonYear: $seasonYear, type: ANIME) { idMal } } }',
            variables: { search: title, seasonYear: Number(year) },
        }),
    }).then(function (res) {
        if (!res.ok) return null;
        return res.json();
    }).then(function (json) {
        return {
            idMal: json && json.data && json.data.Page && json.data.Page.media && json.data.Page.media[0]
                ? json.data.Page.media[0].idMal
                : null,
        };
    }).catch(function () {
        return { idMal: null };
    });
}

function getHiAnimeIdFromMalSync(malId) {
    if (!malId) return Promise.resolve(null);
    return fetchJson(MALSYNC_API + '/mal/anime/' + malId).then(function (json) {
        const sites = json && (json.Sites || json.sites);
        const zoro = sites && (sites.Zoro || sites.zoro);
        if (!zoro) return null;
        const values = Object.keys(zoro).map(function (key) { return zoro[key]; });
        const first = values[0];
        return first ? (first.identifier || null) : null;
    }).catch(function () {
        return null;
    });
}

function extractMegacloud(embedUrl, effectiveType) {
    const mainUrl = 'https://megacloud.blog';
    const headers = {
        Accept: '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: mainUrl,
        'User-Agent': 'Mozilla/5.0',
    };

    return fetchText(embedUrl, { headers: headers }).then(function (page) {
        if (!page) return [];
        const directNonce = page.match(/\b[a-zA-Z0-9]{48}\b/);
        let nonce = directNonce ? directNonce[0] : null;
        if (!nonce) {
            const triple = page.match(/\b([a-zA-Z0-9]{16})\b.*?\b([a-zA-Z0-9]{16})\b.*?\b([a-zA-Z0-9]{16})\b/);
            nonce = triple ? triple[1] + triple[2] + triple[3] : null;
        }
        if (!nonce) return [];

        const id = embedUrl.split('/').pop().split('?')[0];
        const apiUrl = mainUrl + '/embed-2/v3/e-1/getSources?id=' + id + '&_k=' + nonce;
        return fetchJson(apiUrl, { headers: headers }).then(function (json) {
            const sources = json && Array.isArray(json.sources) ? json.sources : [];
            if (!sources.length || !sources[0].file) return [];
            const subtitles = (json.tracks || []).filter(function (track) {
                return track.kind === 'captions' || track.kind === 'subtitles';
            }).map(function (track) {
                return { label: track.label || 'Unknown', url: track.file };
            }).filter(function (track) {
                return !!track.url;
            });
            return [{
                name: 'HiAnime Megacloud',
                title: effectiveType,
                url: sources[0].file,
                quality: 'Auto',
                subtitles: subtitles,
                headers: {
                    Origin: 'https://megacloud.blog',
                    Referer: 'https://megacloud.blog/',
                    'User-Agent': COMMON_HEADERS['User-Agent'],
                },
            }];
        });
    }).catch(function () {
        return [];
    });
}

function invokeHiAnime(mediaInfo, season, episode) {
    if (mediaInfo.mediaType !== 'tv') return Promise.resolve([]);

    const aired = Number(season) > 1
        ? getTmdbSeasonAirDate(mediaInfo.tmdbId, season)
        : Promise.resolve(mediaInfo.firstAirDate);

    return aired.then(function (airedDate) {
        const year = ((airedDate || mediaInfo.firstAirDate || '') || '').split('-')[0] || mediaInfo.year;
        return tmdbToAnimeId(mediaInfo.title, year);
    }).then(function (ids) {
        if (!ids.idMal) return [];
        return getHiAnimeIdFromMalSync(ids.idMal);
    }).then(function (hiId) {
        if (!hiId) return [];
        const epNum = String(episode || 1);
        let chain = Promise.resolve([]);

        HIANIME_APIS.forEach(function (api) {
            chain = chain.then(function (existing) {
                if (existing.length) return existing;
                return fetchJson(api + '/ajax/v2/episode/list/' + hiId, { headers: AJAX_HEADERS }).then(function (list) {
                    if (!list || !list.html) return [];
                    const $ = cheerio.load(list.html);
                    const epId = $('a[data-number]').filter(function (_, el) {
                        return $(el).attr('data-number') === epNum;
                    }).attr('data-id');
                    if (!epId) return [];
                    return fetchJson(api + '/ajax/v2/episode/servers?episodeId=' + epId, { headers: AJAX_HEADERS }).then(function (srv) {
                        if (!srv || !srv.html) return [];
                        const $$ = cheerio.load(srv.html);
                        const links = [];
                        $$('div.server-item').each(function (_, el) {
                            const serverId = $$(el).attr('data-id');
                            const serverName = ($$(el).text() || '').trim().toLowerCase();
                            if (!serverId) return;
                            links.push({ serverId: serverId, serverName: serverName });
                        });
                        if (!links.length) return [];

                        let serverChain = Promise.resolve([]);
                        links.forEach(function (entry) {
                            serverChain = serverChain.then(function (streams) {
                                if (streams.length) return streams;
                                if (entry.serverName.indexOf('mega') === -1 && entry.serverName.indexOf('vid') === -1) return [];
                                return fetchJson(api + '/ajax/v2/episode/sources?id=' + entry.serverId, { headers: AJAX_HEADERS }).then(function (src) {
                                    const embedUrl = src && src.link ? src.link : null;
                                    if (!embedUrl || embedUrl.indexOf('megacloud') === -1) return [];
                                    return extractMegacloud(embedUrl, 'Episode ' + epNum);
                                }).catch(function () {
                                    return [];
                                });
                            });
                        });
                        return serverChain;
                    });
                }).catch(function () {
                    return [];
                });
            });
        });

        return chain;
    }).catch(function () {
        return [];
    });
}

const MOVIESDRIVE_DOMAINS_URL = 'https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json';
const XDMOVIES_API = 'https://xdmovies.site';
const MULTI_DECRYPT_API = 'https://enc-dec.app/api';
const VIDLINK_API = 'https://vidlink.pro';
const MAPPLE_API = 'https://mapple.uk';
const VIDSRCCC_API = 'https://vidsrc.cc';
const XDMOVIES_HEADERS = {
    'User-Agent': COMMON_HEADERS['User-Agent'],
    Referer: XDMOVIES_API + '/',
    'x-requested-with': 'XMLHttpRequest',
    'x-auth-token': typeof atob === 'function' ? atob('NzI5N3Nra2loa2Fqd25zZ2FrbGFrc2h1d2Q=') : '7297skkihkajwnsgaklakshuwd',
};

let moviesDriveUrl = 'https://moviesdrive.forum';
let moviesDriveDomainTs = 0;

function csFormatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function csExtractServerName(source) {
    if (!source) return 'Unknown';
    const src = String(source).trim();
    if (/HubCloud/i.test(src)) return 'HubCloud';
    if (/Pixeldrain/i.test(src)) return 'Pixeldrain';
    if (/StreamTape/i.test(src)) return 'StreamTape';
    if (/HubCdn/i.test(src)) return 'HubCdn';
    if (/HbLinks/i.test(src)) return 'HbLinks';
    if (/Hubstream/i.test(src)) return 'Hubstream';
    if (/GDFlix/i.test(src)) return 'GDFlix';
    if (/GoFile/i.test(src)) return 'GoFile';
    return src.replace(/^www\./i, '').split(/[.\s]/)[0];
}

function csCleanTitle(title) {
    const parts = String(title || '').split(/[.\-_]/);
    const qualityTags = ['WEBRip', 'WEB-DL', 'WEB', 'BluRay', 'HDRip', 'DVDRip', 'HDTV', 'CAM', 'TS', 'R5', 'DVDScr', 'BRRip', 'BDRip', 'DVD', 'PDTV', 'HD'];
    const audioTags = ['AAC', 'AC3', 'DTS', 'MP3', 'FLAC', 'DD5', 'EAC3', 'Atmos'];
    const subTags = ['ESub', 'ESubs', 'Subs', 'MultiSub', 'NoSub', 'EnglishSub', 'HindiSub'];
    const codecTags = ['x264', 'x265', 'H264', 'HEVC', 'AVC'];
    const startIndex = parts.findIndex(function (part) {
        return qualityTags.some(function (tag) { return part.toLowerCase().indexOf(tag.toLowerCase()) !== -1; });
    });
    const endIndex = parts.map(function (part, index) {
        return {
            index: index,
            hit: subTags.concat(audioTags, codecTags).some(function (tag) { return part.toLowerCase().indexOf(tag.toLowerCase()) !== -1; }),
        };
    }).filter(function (item) { return item.hit; }).map(function (item) { return item.index; }).pop();
    if (startIndex !== -1 && endIndex !== undefined && endIndex >= startIndex) return parts.slice(startIndex, endIndex + 1).join('.');
    if (startIndex !== -1) return parts.slice(startIndex).join('.');
    return parts.slice(-3).join('.');
}

function csIndexQuality(value) {
    const match = String(value || '').match(/\b(2160|1440|1080|720|576|540|480|360)\s*[pP]?\b/);
    return match ? parseInt(match[1], 10) : 0;
}

function csNumericToQuality(value) {
    if (value >= 2160) return '2160p';
    if (value >= 1440) return '1440p';
    if (value >= 1080) return '1080p';
    if (value >= 720) return '720p';
    if (value >= 480) return '480p';
    if (value >= 360) return '360p';
    return value ? String(value) : 'Unknown';
}

function csFetchWithHeaders(url, headers, options) {
    return fetch(url, Object.assign({
        headers: Object.assign({}, COMMON_HEADERS, headers || {}),
    }, options || {}));
}

function csPixelDrainExtractor(link, forcedQuality) {
    const match = String(link).match(/(?:file|u)\/([A-Za-z0-9]+)/);
    const fileId = match ? match[1] : String(link).split('/').pop();
    if (!fileId) return Promise.resolve([]);
    const infoUrl = 'https://pixeldrain.com/api/file/' + fileId + '/info';
    return csFetchWithHeaders(infoUrl).then(function (response) {
        return response.json();
    }).then(function (info) {
        const inferred = info && info.name ? csIndexQuality(info.name) : 0;
        return [{
            source: 'Pixeldrain',
            quality: forcedQuality || inferred,
            url: 'https://pixeldrain.com/api/file/' + fileId + '?download',
            name: info && info.name ? info.name : '',
            size: info && info.size ? info.size : 0,
        }];
    }).catch(function () {
        return [{
            source: 'Pixeldrain',
            quality: forcedQuality || 0,
            url: 'https://pixeldrain.com/api/file/' + fileId + '?download',
        }];
    });
}

function csStreamTapeExtractor(link) {
    const url = new URL(link);
    url.hostname = 'streamtape.com';
    return csFetchWithHeaders(url.toString()).then(function (res) {
        return res.text();
    }).then(function (data) {
        const match = data.match(/'(\/\/streamtape\.com\/get_video[^']+)'/);
        if (!match) return [];
        return [{ source: 'StreamTape', quality: 0, url: 'https:' + match[1] }];
    }).catch(function () {
        return [];
    });
}

function csHubStreamExtractor(url, referer) {
    return Promise.resolve([{ source: 'Hubstream', quality: 0, url: url, headers: { Referer: referer || url } }]);
}

function csHbLinksExtractor(url, referer) {
    return csFetchWithHeaders(url, { Referer: referer || url }).then(function (response) {
        return response.text();
    }).then(function (html) {
        const $ = cheerio.load(html);
        const links = $('h3 a, div.entry-content p a').map(function (_, el) {
            return $(el).attr('href');
        }).get().filter(Boolean);
        return Promise.all(links.map(function (link) {
            return csLoadExtractor(link, url);
        })).then(function (results) {
            return [].concat.apply([], results);
        });
    }).catch(function () {
        return [];
    });
}

function csHubCdnExtractor(url, referer) {
    return csFetchWithHeaders(url, { Referer: referer || url }).then(function (response) {
        return response.text();
    }).then(function (data) {
        const encodedMatch = data.match(/r=([A-Za-z0-9+/=]+)/);
        if (!encodedMatch || typeof atob !== 'function') return [];
        const decoded = atob(encodedMatch[1]);
        const m3u8Link = decoded.substring(decoded.lastIndexOf('link=') + 5);
        if (!m3u8Link) return [];
        return [{ source: 'HubCdn', quality: 0, url: m3u8Link }];
    }).catch(function () {
        return [];
    });
}

function csHubDriveExtractor(url, referer) {
    return csFetchWithHeaders(url, { Referer: referer || url }).then(function (response) {
        return response.text();
    }).then(function (html) {
        const $ = cheerio.load(html);
        const href = $('.btn.btn-primary.btn-user.btn-success1.m-1').attr('href');
        return href ? csLoadExtractor(href, url) : [];
    }).catch(function () {
        return [];
    });
}

function csHubCloudExtractor(url, referer) {
    let currentUrl = String(url || '');
    if (currentUrl.indexOf('hubcloud.ink') !== -1) currentUrl = currentUrl.replace('hubcloud.ink', 'hubcloud.dad');
    const fetchInitial = /\/(video|drive)\//i.test(currentUrl)
        ? csFetchWithHeaders(currentUrl, { Referer: referer || currentUrl }).then(function (r) { return r.text(); }).then(function (html) {
            const $ = cheerio.load(html);
            const hubPhp = $('a[href*="hubcloud.php"]').attr('href');
            return hubPhp ? { pageData: null, finalUrl: hubPhp, recurse: true } : { pageData: '', finalUrl: currentUrl, recurse: false };
        })
        : csFetchWithHeaders(currentUrl, { Referer: referer || currentUrl }).then(function (r) { return r.text(); }).then(function (pageData) {
            const scriptUrlMatch = pageData.match(/var url = '([^']*)'/);
            if (!scriptUrlMatch || !scriptUrlMatch[1]) return { pageData: pageData, finalUrl: currentUrl, recurse: false };
            return csFetchWithHeaders(scriptUrlMatch[1], { Referer: currentUrl }).then(function (r) { return r.text(); }).then(function (secondData) {
                return { pageData: secondData, finalUrl: scriptUrlMatch[1], recurse: false };
            });
        });

    return fetchInitial.then(function (payload) {
        if (payload.recurse) return csHubCloudExtractor(payload.finalUrl, currentUrl);
        const $ = cheerio.load(payload.pageData || '');
        const size = $('i#size').text().trim();
        const header = $('div.card-header').text().trim();
        const quality = csIndexQuality(header) || 2160;
        const headerDetails = csCleanTitle(header);
        const sizeMatch = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
        const sizeBytes = sizeMatch ? parseFloat(sizeMatch[1]) * (sizeMatch[2].toUpperCase() === 'GB' ? 1024 ** 3 : sizeMatch[2].toUpperCase() === 'MB' ? 1024 ** 2 : 1024) : 0;
        const fileName = header || headerDetails || 'Unknown';
        const links = [];
        const jobs = $('a.btn[href]').map(function (_, el) {
            const link = $(el).attr('href');
            const text = $(el).text();
            if (!link || /telegram/i.test(text) || /telegram/i.test(link)) return Promise.resolve();
            if (text.indexOf('Download File') !== -1 || text.indexOf('FSL') !== -1 || text.indexOf('S3 Server') !== -1) {
                links.push({ source: 'HubCloud', quality: quality, url: link, size: sizeBytes, fileName: fileName });
                return Promise.resolve();
            }
            if (link.indexOf('pixeldra') !== -1) {
                return csPixelDrainExtractor(link, quality).then(function (extracted) {
                    extracted.forEach(function (item) { item.size = item.size || sizeBytes; item.fileName = item.fileName || fileName; });
                    links.push.apply(links, extracted);
                });
            }
            return csLoadExtractor(link, payload.finalUrl).then(function (extracted) {
                extracted.forEach(function (item) {
                    item.size = item.size || sizeBytes;
                    item.fileName = item.fileName || fileName;
                });
                links.push.apply(links, extracted);
            });
        }).get();
        return Promise.all(jobs).then(function () { return links; });
    }).catch(function () {
        return [];
    });
}

function csLoadExtractor(url, referer) {
    const hostname = new URL(url).hostname;
    if (hostname.indexOf('hubcloud') !== -1) return csHubCloudExtractor(url, referer);
    if (hostname.indexOf('hubdrive') !== -1) return csHubDriveExtractor(url, referer);
    if (hostname.indexOf('hubcdn') !== -1) return csHubCdnExtractor(url, referer);
    if (hostname.indexOf('hblinks') !== -1) return csHbLinksExtractor(url, referer);
    if (hostname.indexOf('hubstream') !== -1) return csHubStreamExtractor(url, referer);
    if (hostname.indexOf('pixeldrain') !== -1) return csPixelDrainExtractor(url);
    if (hostname.indexOf('streamtape') !== -1) return csStreamTapeExtractor(url);
    if (hostname.indexOf('google.') !== -1 || hostname.indexOf('ampproject.org') !== -1 || hostname.indexOf('gstatic.') !== -1 || hostname.indexOf('doubleclick.') !== -1 || hostname.indexOf('ddl2') !== -1 || hostname.indexOf('linkrit') !== -1) return Promise.resolve([]);
    return Promise.resolve([{ source: hostname.replace(/^www\./, ''), quality: 0, url: url }]);
}

function updateMoviesDriveDomain() {
    const now = Date.now();
    if (now - moviesDriveDomainTs < 4 * 60 * 60 * 1000) return Promise.resolve(moviesDriveUrl);
    return csFetchWithHeaders(MOVIESDRIVE_DOMAINS_URL).then(function (response) {
        return response.json();
    }).then(function (data) {
        if (data && (data.Moviesdrive || data.moviesdrive)) {
            moviesDriveUrl = data.Moviesdrive || data.moviesdrive;
            moviesDriveDomainTs = now;
        }
        return moviesDriveUrl;
    }).catch(function () {
        return moviesDriveUrl;
    });
}

function normalizeTitleForMatch(title) {
    return String(title || '').toLowerCase().replace(/\b(the|a|an)\b/g, '').replace(/[:\-_]/g, ' ').replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim();
}

function titleSimilarity(a, b) {
    const normA = normalizeTitleForMatch(a);
    const normB = normalizeTitleForMatch(b);
    if (!normA || !normB) return 0;
    if (normA === normB) return 1;
    if (normA.indexOf(normB) !== -1 || normB.indexOf(normA) !== -1) return 0.9;
    const wordsA = normA.split(/\s+/).filter(function (w) { return w.length > 2; });
    const wordsB = normB.split(/\s+/).filter(function (w) { return w.length > 2; });
    const setB = {};
    wordsB.forEach(function (w) { setB[w] = true; });
    let common = 0;
    wordsA.forEach(function (w) { if (setB[w]) common += 1; });
    const union = new Set(wordsA.concat(wordsB)).size || 1;
    return common / union;
}

function findBestMoviesDriveMatch(mediaInfo, searchResults, mediaType, season) {
    let best = null;
    let bestScore = 0;
    (searchResults || []).forEach(function (result) {
        let score = titleSimilarity(mediaInfo.title, result.title);
        if (mediaInfo.year && result.year) {
            const diff = Math.abs(Number(mediaInfo.year) - Number(result.year));
            if (diff === 0) score += 0.2;
            else if (diff <= 1) score += 0.1;
            else if (diff > 5) score -= 0.3;
        }
        if (mediaType === 'tv' && season) {
            const titleLower = String(result.title || '').toLowerCase();
            if (titleLower.indexOf('season ' + season) !== -1 || titleLower.indexOf('s' + season) !== -1) score += 0.3;
        }
        if (score > bestScore && score > 0.3) {
            best = result;
            bestScore = score;
        }
    });
    return best;
}

function moviesDriveSearch(mediaInfo) {
    return updateMoviesDriveDomain().then(function (domain) {
        const query = mediaInfo.imdbId || mediaInfo.title;
        return csFetchWithHeaders(domain + '/searchapi.php?q=' + encodeURIComponent(query) + '&page=1', { Referer: domain + '/' }).then(function (res) {
            return res.json();
        }).then(function (json) {
            const hits = json && json.hits ? json.hits : [];
            return hits.map(function (hit) { return hit.document; }).filter(function (doc) {
                return !mediaInfo.imdbId || doc.imdb_id === mediaInfo.imdbId;
            }).map(function (doc) {
                const match = String(doc.post_title || '').match(/\b(19|20)\d{2}\b/);
                return {
                    title: doc.post_title,
                    url: doc.permalink && doc.permalink.indexOf('http') === 0 ? doc.permalink : domain + (String(doc.permalink || '').charAt(0) === '/' ? '' : '/') + String(doc.permalink || ''),
                    year: match ? Number(match[0]) : null,
                };
            });
        });
    }).catch(function () {
        return [];
    });
}

function moviesDriveGetLinks(mediaUrl, season, episode) {
    return updateMoviesDriveDomain().then(function (domain) {
        return csFetchWithHeaders(mediaUrl, { Referer: domain + '/' }).then(function (response) {
            return response.text();
        });
    }).then(function (html) {
        const $ = cheerio.load(html);
        const isMovie = $('h1.post-title').text().toLowerCase().indexOf('movie') !== -1;
        if (isMovie || !season) {
            const pages = $('h5 a').map(function (_, el) { return $(el).attr('href'); }).get().filter(Boolean);
            return Promise.all(pages.map(function (url) {
                return csFetchWithHeaders(url, { 'User-Agent': 'Mozilla/5.0' }).then(function (res) {
                    return res.text();
                }).then(function (page) {
                    const $$ = cheerio.load(page);
                    const links = $$('a[href]').map(function (_, el) {
                        const href = $$(el).attr('href');
                        return /hubcloud|gdflix|gdlink|pixeldrain|streamtape/i.test(String(href || '')) ? href : null;
                    }).get().filter(Boolean);
                    return Promise.all(links.map(function (link) {
                        return csLoadExtractor(link, mediaUrl);
                    })).then(function (results) {
                        return [].concat.apply([], results);
                    });
                }).catch(function () {
                    return [];
                });
            })).then(function (results) {
                return [].concat.apply([], results);
            });
        }

        const seasonPattern = new RegExp('Season\\s*0?' + season + '\\b', 'i');
        const episodePattern = new RegExp('Ep\\s*0?' + episode + '\\b', 'i');
        const seasonPageUrls = [];
        $('h5').each(function (_, el) {
            if (seasonPattern.test($(el).text())) {
                $(el).nextAll('h5').each(function (_, h5) {
                    const a = $(h5).find('a[href]');
                    if (a.length && /single\s*episode/i.test(a.text()) && !/zip/i.test(a.text())) {
                        const href = a.attr('href');
                        if (href && seasonPageUrls.indexOf(href) === -1) seasonPageUrls.push(href);
                    }
                });
            }
        });
        return Promise.all(seasonPageUrls.map(function (seasonPageUrl) {
            return csFetchWithHeaders(seasonPageUrl).then(function (r) { return r.text(); }).then(function (seasonHtml) {
                const $$ = cheerio.load(seasonHtml);
                const episodeLinks = [];
                $$('h5').each(function (_, h) {
                    if (episodePattern.test($$(h).text())) {
                        let next = $$(h).next();
                        while (next.length && next.prop('tagName') !== 'HR') {
                            const a = next.find('a[href]').addBack('a[href]');
                            if (a.length) {
                                const href = a.attr('href');
                                if (/hubcloud|gdflix|pixeldrain|streamtape/i.test(String(href || ''))) episodeLinks.push(href);
                            }
                            next = next.next();
                        }
                    }
                });
                return Promise.all(episodeLinks.map(function (link) { return csLoadExtractor(link, seasonPageUrl); })).then(function (results) {
                    return [].concat.apply([], results);
                });
            }).catch(function () {
                return [];
            });
        })).then(function (results) {
            return [].concat.apply([], results);
        });
    }).catch(function () {
        return [];
    });
}

function invokeMoviesDrive(mediaInfo, season, episode) {
    return moviesDriveSearch(mediaInfo).then(function (searchResults) {
        if (!searchResults.length) return [];
        const selected = findBestMoviesDriveMatch(mediaInfo, searchResults, mediaInfo.mediaType, season) || searchResults[0];
        return moviesDriveGetLinks(selected.url, season, episode).then(function (links) {
            const seen = {};
            return links.filter(function (link) {
                if (!link || !link.url || seen[link.url]) return false;
                seen[link.url] = true;
                return true;
            }).map(function (link) {
                return {
                    name: 'MoviesDrive ' + csExtractServerName(link.source),
                    title: mediaInfo.mediaType === 'tv' && season && episode
                        ? mediaInfo.title + ' S' + String(season).padStart(2, '0') + 'E' + String(episode).padStart(2, '0')
                        : mediaInfo.year ? mediaInfo.title + ' (' + mediaInfo.year + ')' : mediaInfo.title,
                    url: link.url,
                    quality: csNumericToQuality(typeof link.quality === 'number' ? link.quality : csIndexQuality(link.fileName || link.source || '')),
                    size: csFormatBytes(link.size),
                    headers: link.headers || {},
                };
            });
        });
    }).catch(function () {
        return [];
    });
}

function invokeXDMovies(mediaInfo, season, episode) {
    if (!mediaInfo.title) return Promise.resolve([]);
    return csFetchWithHeaders(XDMOVIES_API + '/php/search_api.php?query=' + encodeURIComponent(mediaInfo.title) + '&fuzzy=true', XDMOVIES_HEADERS).then(function (r) {
        return r.ok ? r.json() : [];
    }).then(function (searchData) {
        if (!Array.isArray(searchData)) return [];
        const matched = searchData.find(function (item) {
            return Number(item.tmdb_id) === Number(mediaInfo.tmdbId);
        });
        if (!matched || !matched.path) return [];
        return csFetchWithHeaders(XDMOVIES_API + matched.path, XDMOVIES_HEADERS).then(function (r) { return r.text(); }).then(function (html) {
            const $ = cheerio.load(html);
            const collected = [];
            const resolveRedirect = function (url) {
                return csFetchWithHeaders(url, XDMOVIES_HEADERS, { redirect: 'manual' }).then(function (res) {
                    if (res.status >= 300 && res.status < 400) {
                        const loc = res.headers.get('location');
                        return loc ? new URL(loc, url).toString() : null;
                    }
                    return url;
                }).catch(function () {
                    return null;
                });
            };

            if (!season) {
                const rawLinks = $('div.download-item a[href]').map(function (_, a) { return $(a).attr('href'); }).get();
                return Promise.all(rawLinks.map(function (raw) {
                    return resolveRedirect(raw).then(function (finalUrl) {
                        if (finalUrl) collected.push(finalUrl);
                    });
                })).then(function () { return collected; });
            }

            const epRegex = new RegExp('S' + String(season).padStart(2, '0') + 'E' + String(episode).padStart(2, '0'), 'i');
            const jobs = [];
            $('div.episode-card').each(function (_, card) {
                const $card = $(card);
                if (!epRegex.test($card.find('.episode-title').text() || '')) return;
                $card.find('a[href]').each(function (_, a) {
                    const raw = $(a).attr('href');
                    if (!raw) return;
                    jobs.push(resolveRedirect(raw).then(function (finalUrl) {
                        if (finalUrl) collected.push(finalUrl);
                    }));
                });
            });
            return Promise.all(jobs).then(function () { return collected; });
        }).then(function (collectedUrls) {
            return Promise.all((collectedUrls || []).map(function (url) {
                return csLoadExtractor(url, XDMOVIES_API);
            })).then(function (results) {
                const flat = [].concat.apply([], results);
                const seen = {};
                return flat.filter(function (link) {
                    if (!link || !link.url || seen[link.url]) return false;
                    seen[link.url] = true;
                    return true;
                }).map(function (link) {
                    return {
                        name: 'XDMovies ' + csExtractServerName(link.source),
                        title: mediaInfo.mediaType === 'tv' && season && episode
                            ? mediaInfo.title + ' S' + String(season).padStart(2, '0') + 'E' + String(episode).padStart(2, '0')
                            : mediaInfo.year ? mediaInfo.title + ' (' + mediaInfo.year + ')' : mediaInfo.title,
                        url: link.url,
                        quality: csNumericToQuality(typeof link.quality === 'number' ? link.quality : csIndexQuality(link.fileName || link.source || '')),
                        size: csFormatBytes(link.size),
                        headers: link.headers || {},
                    };
                });
            });
        });
    }).catch(function () {
        return [];
    });
}

function invokeVidlink(mediaInfo, season, episode) {
    return csFetchWithHeaders(MULTI_DECRYPT_API + '/enc-vidlink?text=' + encodeURIComponent(String(mediaInfo.tmdbId))).then(function (response) {
        return response.json();
    }).then(function (json) {
        const enc = json && json.result ? json.result : null;
        if (!enc) return [];
        const headers = {
            'User-Agent': COMMON_HEADERS['User-Agent'],
            Connection: 'keep-alive',
            Referer: VIDLINK_API + '/',
            Origin: VIDLINK_API,
        };
        const epUrl = season == null
            ? VIDLINK_API + '/api/b/movie/' + enc
            : VIDLINK_API + '/api/b/tv/' + enc + '/' + season + '/' + episode;
        return csFetchWithHeaders(epUrl, headers).then(function (r) { return r.text(); }).then(function (text) {
            const data = JSON.parse(text);
            const m3u8 = data && data.stream ? data.stream.playlist : null;
            if (!m3u8) return [];
            return [{
                name: 'Vidlink',
                title: mediaInfo.year ? mediaInfo.title + ' (' + mediaInfo.year + ')' : mediaInfo.title,
                url: m3u8,
                quality: 'Auto',
                headers: headers,
            }];
        });
    }).catch(function () {
        return [];
    });
}

function invokeVidsrcCC(mediaInfo, season, episode) {
    if (!mediaInfo.imdbId) return Promise.resolve([]);
    const headers = {
        'User-Agent': COMMON_HEADERS['User-Agent'],
        Referer: VIDSRCCC_API + '/',
    };
    const type = season == null ? 'movie' : 'tv';
    const embedUrl = season != null && episode != null
        ? VIDSRCCC_API + '/v2/embed/' + type + '/' + mediaInfo.imdbId + '/' + season + '/' + episode
        : VIDSRCCC_API + '/v2/embed/' + type + '/' + mediaInfo.imdbId;
    return csFetchWithHeaders(embedUrl, headers).then(function (response) {
        return response.text();
    }).then(function (html) {
        const v = (html.match(/var v = "(.*?)";/) || [])[1];
        const userId = (html.match(/var userId = "(.*?)";/) || [])[1];
        const movieId = (html.match(/var movieId = "(.*?)";/) || [])[1];
        if (!v || !userId || !movieId) return [];
        return csFetchWithHeaders(MULTI_DECRYPT_API + '/enc-vidsrc?user_id=' + encodeURIComponent(userId) + '&movie_id=' + encodeURIComponent(movieId)).then(function (r) {
            return r.text();
        }).then(function (encText) {
            const encrypted = (JSON.parse(encText) || {}).result;
            if (!encrypted) return [];
            let serversUrl = VIDSRCCC_API + '/api/' + movieId + '/servers?id=' + movieId + '&type=' + type + '&v=' + encodeURIComponent(v) + '&vrf=' + encodeURIComponent(encrypted) + '&imdbId=' + encodeURIComponent(mediaInfo.imdbId);
            if (season != null) serversUrl += '&season=' + season;
            if (episode != null) serversUrl += '&episode=' + episode;
            return csFetchWithHeaders(serversUrl, headers).then(function (r) { return r.text(); }).then(function (serversText) {
                const serverData = JSON.parse(serversText);
                const arr = serverData && serverData.data ? serverData.data : [];
                const map = {};
                arr.forEach(function (obj) {
                    if (obj && obj.name && obj.hash) map[obj.name] = obj.hash;
                });
                const jobs = [];
                if (map.VidPlay) {
                    jobs.push(csFetchWithHeaders(VIDSRCCC_API + '/api/source/' + map.VidPlay, headers).then(function (r) { return r.text(); }).then(function (txt) {
                        const data = JSON.parse(txt);
                        const streamUrl = data && data.data ? data.data.source : null;
                        return streamUrl ? [{
                            name: 'VidsrcCC [VidPlay]',
                            title: mediaInfo.year ? mediaInfo.title + ' (' + mediaInfo.year + ')' : mediaInfo.title,
                            url: streamUrl,
                            quality: '1080p',
                            headers: headers,
                        }] : [];
                    }).catch(function () { return []; }));
                }
                return Promise.all(jobs).then(function (results) {
                    return [].concat.apply([], results);
                });
            });
        });
    }).catch(function () {
        return [];
    });
}

function dedupeStreams(streams) {
    const seen = {};
    return streams.filter(function (stream) {
        const key = [stream.name || '', stream.title || '', stream.url || ''].join('||');
        if (!stream.url || seen[key]) return false;
        seen[key] = true;
        return true;
    });
}

function getStreams(tmdbId, mediaType, season, episode) {
    const normalizedType = mediaType === 'movie' ? 'movie' : 'tv';
    const normalizedSeason = season == null ? null : Number(season);
    const normalizedEpisode = episode == null ? null : Number(episode);

    return getTmdbInfo(tmdbId, normalizedType).then(function (mediaInfo) {
        const tasks = [];

        STREMIO_PROVIDERS.forEach(function (provider) {
            tasks.push(invokeStremioStreams(provider, mediaInfo, normalizedSeason, normalizedEpisode));
        });

        tasks.push(invokeMoviesDrive(mediaInfo, normalizedSeason, normalizedEpisode));
        tasks.push(invokeXDMovies(mediaInfo, normalizedSeason, normalizedEpisode));
        tasks.push(invokeVidlink(mediaInfo, normalizedSeason, normalizedEpisode));
        tasks.push(invokeVidsrcCC(mediaInfo, normalizedSeason, normalizedEpisode));

        if (normalizedType === 'tv') {
            ANIME_STREMIO_PROVIDERS.forEach(function (provider) {
                tasks.push(invokeStremioStreams(provider, mediaInfo, normalizedSeason, normalizedEpisode));
            });
            tasks.push(invokeHiAnime(mediaInfo, normalizedSeason, normalizedEpisode));
        }

        return Promise.all(tasks).then(function (results) {
            return dedupeStreams([].concat.apply([], results));
        });
    }).catch(function (error) {
        console.error('[CineStream] Error:', error && error.message ? error.message : String(error));
        return [];
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = { getStreams: getStreams };
}
