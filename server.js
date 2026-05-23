const app = require('./src/app');
const { buildWikiIndex } = require('./src/scrapers/wikipedia');

const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
    buildWikiIndex({
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
        timeout: 8000
    });
    console.log(`[System] Stremio Stinger Pro initialized on port ${PORT}.`);
});
