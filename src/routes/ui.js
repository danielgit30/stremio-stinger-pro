const path = require('path');

const serveConfig = (req, res) => res.sendFile(path.join(__dirname, '../../public/index.html'));

module.exports = { serveConfig };
