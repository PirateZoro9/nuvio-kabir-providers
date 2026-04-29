const { getStreams } = require('./providers/streamflix.js');

async function test() {
    console.log("Testing StreamFlix with Proxy...");
    // Using title directly to bypass local TMDB timeout
    const streams = await getStreams("The Boys", "tv", 1, 1);
    console.log(`Results: ${streams.length}`);
    if (streams.length > 0) {
        console.log("Sample Result:", streams[0].name);
        console.log("Title Details:", streams[0].title);
    }
}

test();
