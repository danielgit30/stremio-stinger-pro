const manifestHandler = (req, res) => {
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({
        id: 'org.stinger.pro',
        version: '2.0.2',
        name: 'Stremio Stinger Pro',
        description:
            'Detects mid/post-credit scenes and optionally bloopers/outtakes and sequel setups. Powered by a multi-tiered scraping system including AfterCredits, MediaStinger, TMDB, and Wikipedia.',
        logo: `${protocol}://${host}/icon.png`,
        types: ['movie'],
        catalogs: [],
        resources: ['stream'],
        idPrefixes: ['tt'],
        behaviorHints: { configurable: true, configurationRequired: false },
    });
};

module.exports = { manifestHandler };
