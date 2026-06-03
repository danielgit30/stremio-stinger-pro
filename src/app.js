const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } = require('./config');
const { sanitizeError } = require('./utils/network');
const { manifestHandler } = require('./routes/manifest');
const { streamHandler } = require('./routes/stream');
const { serveConfig, telemetryHandler } = require('./routes/ui');

const app = express();

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' https://github.com data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
    );
    next();
});

app.set('trust proxy', 1);

// Rate Limiting
const rateLimitMap = new Map();

const rateLimiter = (req, res, next) => {
    const ip = req.ip;
    if (!ip) return next();

    const now = Date.now();
    const clientData = rateLimitMap.get(ip) || { count: 0, startTime: now };

    if (now - clientData.startTime > RATE_LIMIT_WINDOW_MS) {
        clientData.count = 1;
        clientData.startTime = now;
    } else {
        clientData.count++;
    }

    // Refresh to front of map for LRU iteration
    const hasIp = rateLimitMap.delete(ip);

    // Prevent memory exhaustion DoS
    if (rateLimitMap.size >= 5000 && !hasIp) {
        const firstKey = rateLimitMap.keys().next().value;
        rateLimitMap.delete(firstKey);
    }

    rateLimitMap.set(ip, clientData);

    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - clientData.count);
    const resetTime = Math.ceil((clientData.startTime + RATE_LIMIT_WINDOW_MS) / 1000);

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
        console.warn(`[Security] Rate limit exceeded for IP: ${sanitizeError(ip)}`);
        const retryAfter = Math.ceil((clientData.startTime + RATE_LIMIT_WINDOW_MS - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    next();
};

// Static files — aggressive caching to prevent repeated icon.png egress
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1d', etag: true, lastModified: true }));
app.get('/icon.png', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path.join(__dirname, '../public/icon.png'));
});

// Routes
app.get('/', serveConfig);
app.get('/configure', serveConfig);
app.get('/telemetry', rateLimiter, telemetryHandler);

app.get('/manifest.json', manifestHandler);
app.get('/:p1/manifest.json', manifestHandler);
app.get('/:style/:apiKey/manifest.json', manifestHandler);

app.get('/stream/:type/:id.json', rateLimiter, streamHandler);
app.get('/:p1/stream/:type/:id.json', rateLimiter, streamHandler);
app.get('/:style/:apiKey/stream/:type/:id.json', rateLimiter, streamHandler);

// Global Error Boundary
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(`[System Error] ${sanitizeError(err.message)}`, err.stack ? `\nStack: ${sanitizeError(err.stack)}` : '');
    res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected error occurred.' });
});

module.exports = app;
