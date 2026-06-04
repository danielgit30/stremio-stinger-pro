const AC_BLOOPER_TAGS = new Set(['bloopers', 'outtakes', 'gag reel', 'extras']);
const categoryTagsArray = ['action', 'adventure', 'sci-fi', 'marvel', 'both during & after credits', 'sequel setup', 'bloopers', 'another tag', 'yet another'];

const ITERATIONS = 1000000;

function benchArray() {
    console.time('Array');
    for (let i = 0; i < ITERATIONS; i++) {
        let hasMid = false, hasPost = false, bloopers = false, sequel = false;
        if (categoryTagsArray.includes('non-stingers')) continue;
        if (categoryTagsArray.includes('unknown')) continue;
        if (categoryTagsArray.length > 0) {
            if (categoryTagsArray.includes('both during & after credits')) {
                hasMid = true;
                hasPost = true;
            }
            if (categoryTagsArray.includes('during credits')) {
                hasMid = true;
            }
            if (categoryTagsArray.includes('after credits')) {
                hasPost = true;
            }
            if (categoryTagsArray.some((t) => AC_BLOOPER_TAGS.has(t))) {
                bloopers = true;
            }
            if (categoryTagsArray.includes('sequel setup')) {
                sequel = true;
            }
        }
    }
    console.timeEnd('Array');
}

function benchSet() {
    console.time('Set');
    const categoryTagsSet = new Set(categoryTagsArray);
    for (let i = 0; i < ITERATIONS; i++) {
        let hasMid = false, hasPost = false, bloopers = false, sequel = false;
        if (categoryTagsSet.has('non-stingers')) continue;
        if (categoryTagsSet.has('unknown')) continue;
        if (categoryTagsSet.size > 0) {
            if (categoryTagsSet.has('both during & after credits')) {
                hasMid = true;
                hasPost = true;
            }
            if (categoryTagsSet.has('during credits')) {
                hasMid = true;
            }
            if (categoryTagsSet.has('after credits')) {
                hasPost = true;
            }
            // for set intersection check:
            let hasBlooper = false;
            for (const t of categoryTagsSet) {
                if (AC_BLOOPER_TAGS.has(t)) {
                    hasBlooper = true;
                    break;
                }
            }
            if (hasBlooper) bloopers = true;

            if (categoryTagsSet.has('sequel setup')) {
                sequel = true;
            }
        }
    }
    console.timeEnd('Set');
}

benchArray();
benchSet();
