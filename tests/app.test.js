const request = require('supertest');
const app = require('../src/app');
const { quitRedis } = require('../src/cache/redis');

describe('Stremio Stinger Pro E2E', () => {
    afterAll(async () => {
        await quitRedis();
    });
    it('should return manifest.json', async () => {
        const res = await request(app).get('/manifest.json');
        expect(res.statusCode).toEqual(200);
        expect(res.body.id).toEqual('org.stinger.pro');
        expect(res.body.resources).toContain('stream');
    });

    it('should serve configure page for different route styles', async () => {
        const res1 = await request(app).get('/configure');
        expect(res1.statusCode).toEqual(200);
        expect(res1.headers['content-type']).toContain('html');

        const res2 = await request(app).get('/colorful/configure');
        expect(res2.statusCode).toEqual(200);
        expect(res2.headers['content-type']).toContain('html');

        const res3 = await request(app).get('/colorful/0287deb172a88d5d62c2ed82e863f4ee/configure');
        expect(res3.statusCode).toEqual(200);
        expect(res3.headers['content-type']).toContain('html');
    });

    it('should return empty streams for non-movie type', async () => {
        const res = await request(app).get('/stream/series/tt0848228.json');
        expect(res.statusCode).toEqual(200);
        expect(res.body.streams).toEqual([]);
    });

    it('should return empty streams for invalid id', async () => {
        const res = await request(app).get('/stream/movie/invalid.json');
        expect(res.statusCode).toEqual(200);
        expect(res.body.streams).toEqual([]);
    });

    // Mocks for external APIs should ideally be added here.
    // For this e2e test, we're simply verifying that the endpoint works without crashing.
    it('should return stream data for a valid movie (The Avengers)', async () => {
        // Warning: This hits external APIs. In a true CI/CD pipeline, we would mock axios or nock these requests.
        const res = await request(app).get('/stream/movie/tt0848228.json');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('streams');
        expect(Array.isArray(res.body.streams)).toBe(true);
        if (res.body.streams.length > 0) {
            expect(res.body.streams[0]).toHaveProperty('name', 'After-Credits Scenes');
            expect(res.body.streams[0]).toHaveProperty('title');
        }
    }, 30000);

    it('should handle concurrent requests for the same movie (request coalescing / singleflight)', async () => {
        const [res1, res2] = await Promise.all([
            request(app).get('/stream/movie/tt0120737.json'), // Lord of the Rings: Fellowship of the Ring
            request(app).get('/stream/movie/tt0120737.json'),
        ]);

        expect(res1.statusCode).toEqual(200);
        expect(res2.statusCode).toEqual(200);
        expect(res1.body).toHaveProperty('streams');
        expect(res2.body).toHaveProperty('streams');
        expect(res1.body.streams).toEqual(res2.body.streams);
    }, 30000);
});
