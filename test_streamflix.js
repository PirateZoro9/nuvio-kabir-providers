const { getStreams } = require('./providers/streamflix.js');

async function test() {
    console.log("Testing StreamFlix Port...");
    // Passing title directly to bypass TMDB API check in restricted environment
    const streams = await getStreams("Venom: Let There Be Carnage", "movie");
    console.log("Movie Streams Found:", streams.length);
    if (streams.length > 0) {
        console.log("Sample Stream:", JSON.stringify(streams[0], null, 2));
    }

    console.log("\nTesting TV Series (The Boys)...");
    const tvStreams = await getStreams("The Boys", "tv", 1, 1);
    console.log("TV Streams Found:", tvStreams.length);
    if (tvStreams.length > 0) {
        console.log("Sample TV Stream:", JSON.stringify(tvStreams[0], null, 2));
    }
}

test();
