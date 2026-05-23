const { checkAfterCredits } = require('./aftercredits');
const { checkMediaStinger } = require('./mediastinger');
const { checkTmdb } = require('./tmdb');
const { checkWikipedia } = require('./wikipedia');

module.exports = {
    checkAfterCredits,
    checkMediaStinger,
    checkTmdb,
    checkWikipedia
};
