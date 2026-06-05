const MEGA_COLLECTIONS = [
    {
        keywordId: 180547,
        name: 'Marvel Cinematic Universe (MCU)',
    },
    {
        keywordId: 312528,
        name: 'DC Universe (DCU)',
    },
    {
        keywordId: 229269,
        name: 'DC Extended Universe (DCEU)',
    },
    {
        keywordId: 290702,
        name: "Sony's Spider-Man Universe (SSU)",
    },
    {
        keywordId: 372735,
        name: 'Star Wars Universe',
    },
    {
        keywordId: 327763,
        name: 'Star Trek Universe',
    },
    {
        keywordId: 253163,
        name: 'Wizarding World',
    },
    {
        keywordId: 261449,
        name: 'The MonsterVerse',
    },
    {
        keywordId: 229156,
        name: 'X-Men Cinematic Universe',
    },
    {
        keywordId: 228795,
        name: 'The Conjuring Universe',
    },
    {
        keywordId: 313881,
        name: 'Spider-Man Expanded Universe',
    },
    {
        keywordId: 295415,
        name: "Tolkien's Middle-Earth",
    },
    {
        keywordId: 246473,
        name: 'Alien & Predator (AVP)',
    },
    {
        keywordId: 297486,
        name: 'The Walking Dead Universe',
    },
    {
        keywordId: 335022,
        name: 'Doctor Who Universe',
    },
];

const BLACKLIST_PATTERNS = [
    /one-shot/i,
    /team thor/i,
    /team darryl/i,
    /holiday special/i,
    /groot/i,
    /magnum opus/i,
    /assembling a universe/i,
    /lego/i,
];

module.exports = {
    MEGA_COLLECTIONS,
    BLACKLIST_PATTERNS,
};
