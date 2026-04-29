/**
 * Universal Nuvio Proxy (StreamFlix + SFlix)
 * Version: 2.0.0
 * 
 * Logic:
 * 1. Default (if tmdb/q is present) -> StreamFlix Proxy Logic (Sandbox Bypass)
 * 2. action=sflix_search -> SFlix Search API (Geo-Lock Bypass)
 * 3. action=sflix_play   -> SFlix Play/Detail/Caption APIs (Geo-Lock Bypass)
 */

function doGet(e) {
  var action = e.parameter.action;

  // --- 1. SFlix Routing (Geo-Lock Bypass) ---
  if (action && action.indexOf("sflix") === 0) {
    return handleSFlix(e);
  }

  // --- 2. Default: StreamFlix Logic (Existing Logic - NO CHANGES) ---
  return handleStreamFlix(e);
}

/**
 * Handles SFlix Requests (Search, Play, Detail, Caption)
 */
function handleSFlix(e) {
  var action = e.parameter.action;
  var baseUrl = "https://sflix.film";
  var headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": baseUrl,
    "Referer": baseUrl + "/"
  };

  try {
    var url, options;

    if (action === "sflix_search") {
      url = baseUrl + "/wefeed-h5-bff/web/subject/search";
      options = {
        method: "post",
        contentType: "application/json;charset=UTF-8",
        headers: headers,
        payload: JSON.stringify({
          keyword: e.parameter.q,
          page: 1,
          perPage: 24,
          subjectType: 0
        }),
        muteHttpExceptions: true
      };
    } 
    else if (action === "sflix_play") {
      url = baseUrl + "/wefeed-h5-bff/web/subject/play?subjectId=" + e.parameter.id + "&se=" + e.parameter.se + "&ep=" + e.parameter.ep;
      if (e.parameter.referer) headers["Referer"] = e.parameter.referer;
      options = { method: "get", headers: headers, muteHttpExceptions: true };
    }
    else if (action === "sflix_detail") {
      url = baseUrl + "/wefeed-h5-bff/web/subject/detail?subjectId=" + e.parameter.id;
      options = { method: "get", headers: headers, muteHttpExceptions: true };
    }
    else if (action === "sflix_caption") {
      url = baseUrl + "/wefeed-h5-bff/web/subject/caption?format=" + e.parameter.format + "&id=" + e.parameter.id + "&subjectId=" + e.parameter.sid;
      if (e.parameter.referer) headers["Referer"] = e.parameter.referer;
      options = { method: "get", headers: headers, muteHttpExceptions: true };
    }

    var response = UrlFetchApp.fetch(url, options);
    return ContentService.createTextOutput(response.getContentText())
                         .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles StreamFlix Requests (Existing Sandbox Crash Bypass)
 * This is exactly the same logic as the previous version.
 */
function handleStreamFlix(e) {
  var tmdb = e.parameter.tmdb;
  var title = e.parameter.title;
  var query = e.parameter.q;

  try {
    var response = UrlFetchApp.fetch("https://api.streamflix.app/data.json");
    var json = JSON.parse(response.getContentText());
    var items = json.data || [];
    var results = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var match = false;
      if (tmdb && item.tmdb && item.tmdb.toString() === tmdb.toString()) {
        match = true;
      } else if (query || title) {
        var searchStr = (query || title).toLowerCase();
        var itemName = (item.moviename || "").toLowerCase();
        if (itemName.indexOf(searchStr) > -1) match = true;
      }
      if (match) {
        results.push(item);
        if (tmdb && results.length > 5) break; 
        if (results.length > 20) break;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      count: results.length,
      data: results
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
