const path = require('path');
const { telemetry } = require('./stream');

const serveConfig = (req, res) => res.sendFile(path.join(__dirname, '../../public/index.html'));

const telemetryHandler = (req, res) => {
    // Basic auth check can be added here if needed, but for now we just expose basic stats
    res.json(telemetry.getStats());
};

module.exports = {
    serveConfig,
    telemetryHandler
};
