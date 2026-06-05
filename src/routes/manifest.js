const manifestHandler = (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({
        id: 'org.stinger.pro',
        version: '3.0.6',
        name: 'Stremio Stinger Pro',
        description:
            'Detects mid/post-credit scenes and optionally bloopers/outtakes and sequel setups. Powered by a multi-tiered scraping system including AfterCredits, TMDB, and Wikipedia.',
        logo: 'https://raw.githubusercontent.com/schultz911/stremio-stinger-pro/main/public/icon.png?v=3.0.6',
        types: ['movie'],
        catalogs: [],
        resources: ['stream'],
        idPrefixes: ['tt'],
        behaviorHints: { configurable: true, configurationRequired: false },
    });
};

module.exports = { manifestHandler };
