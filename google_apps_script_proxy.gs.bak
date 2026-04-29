/**
 * StreamFlix Proxy for Nuvio
 * Bypasses the 2.7MB JSON parsing crash in the Nuvio Hermes sandbox.
 * Filters data on Google's servers and returns only the necessary metadata.
 */

function doGet(e) {
  var tmdb = e.parameter.tmdb;
  var title = e.parameter.title;
  var query = e.parameter.q;

  try {
    // 1. Fetch the massive data.json from StreamFlix
    var response = UrlFetchApp.fetch("https://api.streamflix.app/data.json");
    var json = JSON.parse(response.getContentText());
    var items = json.data || [];

    var results = [];

    // 2. Filter logic (Server-side)
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var match = false;

      // Match by TMDB ID
      if (tmdb && item.tmdb && item.tmdb.toString() === tmdb.toString()) {
        match = true;
      } 
      // Match by Title (Fuzzy)
      else if (query || title) {
        var searchStr = (query || title).toLowerCase();
        var itemName = (item.moviename || "").toLowerCase();
        if (itemName.indexOf(searchStr) > -1) {
          match = true;
        }
      }

      if (match) {
        results.push(item);
        // If we found a direct TMDB match, we can stop early to keep payload small
        if (tmdb && results.length > 5) break; 
        if (results.length > 20) break; // Limit search results to prevent huge responses
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      count: results.length,
      data: results
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
