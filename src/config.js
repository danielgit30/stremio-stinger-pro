const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Programmatically load .env files if they exist (runs on all Node versions)
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            const match = trimmedLine.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                if (process.env[key] === undefined) {
                    process.env[key] = value.trim();
                }
            }
        });
    } catch (e) {
        console.error('[System Warning] Failed to read .env file:', e.message);
    }
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

const DEFAULT_TMDB_KEY = process.env.TMDB_API_KEY || '';
const WIKI_TTL = 24 * 60 * 60 * 1000;
const METADATA_TTL = 24 * 60 * 60 * 1000; // 24 hours (static metadata)
const CACHE_TTL_SUCCESS = 30 * 60 * 1000;
const CACHE_TTL_ERROR = 60 * 1000;
const MAX_CACHE_SIZE = 5000;

const CINEMETA_TIMEOUT = 5000; // 5 seconds
const SCRAPER_TIMEOUT = 10000; // 10 seconds
const ENABLE_LOGGING = process.env.ENABLE_LOGGING !== 'false';

// Centralized Axios config with Keep-Alive for low latency
const axiosConfig = {
    headers: {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate, br',
    },
    timeout: 15000, // 15 seconds
    httpAgent: new http.Agent({ keepAlive: true, family: 4 }),
    httpsAgent: new https.Agent({ keepAlive: true, family: 4 }),
};

module.exports = {
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_TMDB_KEY,
    WIKI_TTL,
    METADATA_TTL,
    CACHE_TTL_SUCCESS,
    CACHE_TTL_ERROR,
    MAX_CACHE_SIZE,
    axiosConfig,
    CINEMETA_TIMEOUT,
    SCRAPER_TIMEOUT,
    ENABLE_LOGGING,
};
