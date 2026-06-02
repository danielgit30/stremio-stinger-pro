const { ENABLE_LOGGING } = require('../config');

const log = (...args) => {
    if (ENABLE_LOGGING) {
        console.log(...args);
    }
};

module.exports = { log };
