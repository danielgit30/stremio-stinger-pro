const express = require('express');
const cors = require('cors');
const path = require('path');
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } = require('./config');
const { sanitizeError } = require('./utils/network');
const { manifestHandler } = require('./routes/manifest');
const { streamHandler } = require('./routes/stream');
const { serveConfig, telemetryHandler } = require('./routes/ui');

const app = express();

app.use(cors());

// Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https://github.com data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'");
    next();
});

app.set('trust proxy', 1);

// Rate Limiting
const rateLimitMap = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitMap.entries()) {
        if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
            rateLimitMap.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW_MS);

app.use((req, res, next) => {
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

    rateLimitMap.set(ip, clientData);

    if (clientData.count > RATE_LIMIT_MAX_REQUESTS) {
        console.warn(`[Security] Rate limit exceeded for IP: ${sanitizeError(ip)}`);
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    next();
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));
app.get('/icon.png', (req, res) => res.sendFile(path.join(__dirname, '../public/icon.png')));

// Routes
app.get('/', serveConfig);
app.get('/configure', serveConfig);
app.get('/telemetry', telemetryHandler);

app.get('/manifest.json', manifestHandler);
app.get('/:p1/manifest.json', manifestHandler);
app.get('/:style/:apiKey/manifest.json', manifestHandler);

app.get('/stream/:type/:id.json', streamHandler);
app.get('/:p1/stream/:type/:id.json', streamHandler);
app.get('/:style/:apiKey/stream/:type/:id.json', streamHandler);

module.exports = app;
