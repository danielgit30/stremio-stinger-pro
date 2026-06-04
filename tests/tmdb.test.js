const { getRelatedMovies } = require('../src/scrapers/tmdb');
const { axiosInstance } = require('../src/utils/network');

jest.mock('../src/utils/network', () => {
    const originalModule = jest.requireActual('../src/utils/network');
    return {
        ...originalModule,
        axiosInstance: {
            get: jest.fn(),
        },
    };
});

describe('TMDB Related Movies Scraper Prequel/Sequel Fix', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should filter out the target movie itself from prequel/sequel discover results (e.g. Superman 2025 case)', async () => {
        const tmdbId = 1061474;
        const targetDate = '2025-07-09';

        axiosInstance.get.mockImplementation(async (url) => {
            if (url.includes(`/movie/${tmdbId}`)) {
                return {
                    data: {
                        id: tmdbId,
                        title: 'Superman',
                        release_date: targetDate,
                        keywords: {
                            keywords: [
                                { id: 312528, name: 'DC Universe (DCU)' },
                                { id: 9717, name: 'based on comic book' },
                            ],
                        },
                    },
                };
            }
            if (url.includes('/discover/movie')) {
                // Return Superman itself for both prequel and sequel searches
                return {
                    data: {
                        results: [
                            {
                                id: tmdbId,
                                title: 'Superman',
                                release_date: targetDate,
                                vote_count: 500,
                            },
                        ],
                    },
                };
            }
            return { data: {} };
        });

        const result = await getRelatedMovies(tmdbId, 'mock-api-key', {}, 'tt0000000');
        expect(result).not.toBeNull();
        expect(result.prequel).toBeNull();
        expect(result.sequel).toBeNull();
    });

    it('should successfully find prequel/sequel when target movie itself is filtered out (e.g. Iron Man 2 case)', async () => {
        const tmdbId = 10138;
        const targetDate = '2010-04-28';

        axiosInstance.get.mockImplementation(async (url) => {
            if (url.includes(`/movie/${tmdbId}`)) {
                return {
                    data: {
                        id: tmdbId,
                        title: 'Iron Man 2',
                        release_date: targetDate,
                        keywords: {
                            keywords: [
                                { id: 180547, name: 'Marvel Cinematic Universe (MCU)' },
                                { id: 9717, name: 'based on comic book' },
                            ],
                        },
                    },
                };
            }
            if (url.includes('/discover/movie')) {
                if (url.includes('primary_release_date.lte=')) {
                    // Prequel search (lte)
                    return {
                        data: {
                            results: [
                                {
                                    id: tmdbId,
                                    title: 'Iron Man 2',
                                    release_date: targetDate,
                                    vote_count: 22000,
                                },
                                {
                                    id: 1724,
                                    title: 'The Incredible Hulk',
                                    release_date: '2008-06-12',
                                    vote_count: 12000,
                                },
                            ],
                        },
                    };
                }
                if (url.includes('primary_release_date.gte=')) {
                    // Sequel search (gte)
                    return {
                        data: {
                            results: [
                                {
                                    id: tmdbId,
                                    title: 'Iron Man 2',
                                    release_date: targetDate,
                                    vote_count: 22000,
                                },
                                {
                                    id: 10195,
                                    title: 'Thor',
                                    release_date: '2011-04-21',
                                    vote_count: 22000,
                                },
                            ],
                        },
                    };
                }
            }
            return { data: {} };
        });

        const result = await getRelatedMovies(tmdbId, 'mock-api-key', {}, 'tt1228705');
        expect(result).not.toBeNull();
        expect(result.prequel).not.toBeNull();
        expect(result.prequel.id).toBe(1724);
        expect(result.prequel.title).toBe('The Incredible Hulk');

        expect(result.sequel).not.toBeNull();
        expect(result.sequel.id).toBe(10195);
        expect(result.sequel.title).toBe('Thor');
    });
});
