const { getRelatedMovies } = require('../src/scrapers/tmdb');
const { DEFAULT_TMDB_KEY } = require('../src/config');

describe('TMDB Related Movies & Mega-Collections', () => {
    const reqConfig = {
        headers: {
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 10000
    };

    it('should correctly categorize a Harry Potter movie under Wizarding World', async () => {
        // tt0241527 is Harry Potter and the Philosopher's Stone
        const res = await getRelatedMovies(null, DEFAULT_TMDB_KEY, reqConfig, 'tt0241527');
        expect(res).not.toBeNull();
        expect(res.collectionName).toEqual('Wizarding World');
        expect(res.collectionUrl).toContain('collection/1241');
        expect(res.sequel).not.toBeNull();
        expect(res.sequel.title).toContain('Chamber of Secrets');
    }, 20000);

    it('should correctly categorize a Lord of the Rings movie under Tolkien\'s Middle-Earth', async () => {
        // tt0120737 is The Lord of the Rings: The Fellowship of the Ring
        const res = await getRelatedMovies(null, DEFAULT_TMDB_KEY, reqConfig, 'tt0120737');
        expect(res).not.toBeNull();
        expect(res.collectionName).toEqual("Tolkien's Middle-Earth");
        expect(res.collectionUrl).toContain('collection/119');
        expect(res.sequel).not.toBeNull();
        expect(res.sequel.title).toContain('The Two Towers');
    }, 20000);

    it('should correctly categorize an Avengers movie under Marvel Cinematic Universe (MCU)', async () => {
        // tt0848228 is The Avengers (2012)
        const res = await getRelatedMovies(null, DEFAULT_TMDB_KEY, reqConfig, 'tt0848228');
        expect(res).not.toBeNull();
        expect(res.collectionName).toEqual('Marvel Cinematic Universe (MCU)');
        expect(res.collectionUrl).toContain('keyword/180547');
        expect(res.sequel).not.toBeNull();
    }, 20000);
});
