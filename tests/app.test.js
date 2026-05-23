const request = require('supertest');
const app = require('../src/app');

describe('Stremio Stinger Pro E2E', () => {
    it('should return manifest.json', async () => {
        const res = await request(app).get('/manifest.json');
        expect(res.statusCode).toEqual(200);
        expect(res.body.id).toEqual('org.stinger.pro');
        expect(res.body.resources).toContain('stream');
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
});
