const { checkAfterCredits } = require('./aftercredits');
const { checkTmdb } = require('./tmdb');
const { checkWikipedia } = require('./wikipedia');

module.exports = {
    checkAfterCredits,
    checkTmdb,
    checkWikipedia,
};
