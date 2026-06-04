const { checkAfterCredits } = require('./aftercredits');
const { checkTmdb, getRelatedMovies } = require('./tmdb');
const { checkWikipedia } = require('./wikipedia');

module.exports = {
    checkAfterCredits,
    checkTmdb,
    checkWikipedia,
    getRelatedMovies,
};
