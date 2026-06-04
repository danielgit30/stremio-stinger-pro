// A very basic benchmark script simulation
const ITERATIONS = 1000;

async function runBenchmark() {
    console.log('Running benchmark simulation for rawScraperCache lookup...');
    const start = Date.now();
    for (let i = 0; i < ITERATIONS; i++) {
        // simulate redis getCache vs http lookup
        const redisSim = { finalResult: { mid: true }, bestFallback: null, title: 'Test', year: 2020 };
        const id = 'tt1234567';

        // This simulates what happens under the hood when hit from Redis
        if (redisSim) {
            let finalResult = redisSim.finalResult;
            let bestFallback = redisSim.bestFallback;
            let title = redisSim.title;
            let year = redisSim.year;
            // ... done (cache hit)
        } else {
            // simulate http delay
            await new Promise(resolve => setTimeout(resolve, 5));
        }
    }
    const end = Date.now();
    console.log(`Simulated cache hit lookups: ${end - start}ms`);

    const start2 = Date.now();
    for (let i = 0; i < ITERATIONS; i++) {
        const id = 'tt1234567';
        // simulate http delay because redis miss
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    const end2 = Date.now();
    console.log(`Simulated cache miss (HTTP fallback): ${end2 - start2}ms`);
}

runBenchmark();
