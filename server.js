const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = String(process.env.PUBLIC_URL || '').replace(/\/+$/, '');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const mimeTypes = {
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.html': 'text/html',
};

function getBaseUrl(req) {
    if (PUBLIC_URL) return PUBLIC_URL;

    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = forwardedProto ? String(forwardedProto).split(',')[0].trim() : 'http';
    const hostHeader = req.headers.host;
    if (hostHeader) return `${proto}://${hostHeader}`;

    const ip = getLocalIp();
    return `http://${ip}:${PORT}`;
}

function loadManifest(baseUrl) {
    const manifestPath = path.join(__dirname, 'manifest.json');
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);
    manifest.url = `${baseUrl}/`;
    return JSON.stringify(manifest, null, 2);
}

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/manifest.json') {
        try {
            const baseUrl = getBaseUrl(req);
            const manifest = loadManifest(baseUrl);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(manifest);
            return;
        } catch (error) {
            res.writeHead(500);
            res.end(`Manifest Error: ${error.message}`);
            return;
        }
    }

    // Prepare file path
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

    // Security check: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov'];

    const extname = path.extname(filePath);
    let contentType = mimeTypes[extname] || 'application/octet-stream';
    if (videoExtensions.includes(extname)) {
        contentType = "video/mp4"; // Defaulting to mp4 for video files for simplicity
    }


    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // If asking for root and index.html doesn't exist, allow checking specific files
                if (req.url === '/') {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Nuvio Providers Server Running. Access /manifest.json to see the manifest.');
                    return;
                }
                res.writeHead(404);
                res.end(`File not found: ${req.url}`);
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, HOST, () => {
    const ip = getLocalIp();
    const localUrl = `http://${ip}:${PORT}`;
    const baseUrl = PUBLIC_URL || localUrl;

    console.log(`\n🚀 Server listening on ${HOST}:${PORT}`);
    console.log(`🌐 Base URL:          ${baseUrl}/`);
    console.log(`📝 Manifest URL:      ${baseUrl}/manifest.json`);
    if (!PUBLIC_URL) {
        console.log('⚠️  PUBLIC_URL not set. This server will only be reachable from devices that can access your current network address.');
    }
    console.log('Press Ctrl+C to stop\n');
});
