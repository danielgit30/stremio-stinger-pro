const app = require('./src/app');
const { buildWikiIndex } = require('./src/scrapers/wikipedia');
const { quitRedis } = require('./src/cache/redis');
const { log, error } = require('./src/utils/logger');

const PORT = process.env.PORT || 7000;

const server = app.listen(PORT, () => {
    buildWikiIndex({
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
        timeout: 8000
    });
    log(`[System] Stremio Stinger Pro initialized on port ${PORT}.`);
});

const gracefulShutdown = async (signal) => {
    log(`\n[System] Received ${signal}. Initiating graceful shutdown...`);
    
    server.close(async (err) => {
        if (err) {
            error('[System] Error during server close:', err);
            process.exit(1);
        }
        log('[System] HTTP server closed.');
        
        await quitRedis();
        
        log('[System] Graceful shutdown complete. Exiting process.');
        process.exit(0);
    });
    
    // Fallback timeout
    setTimeout(() => {
        error('[System] Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
