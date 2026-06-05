const MEGA_COLLECTIONS = [
    {
        name: 'Marvel Cinematic Universe (MCU)',
        keywordId: 180547,
        keywordIds: [180547],
        collectionIds: []
    },
    {
        name: 'DC Universe (DCU)',
        keywordId: 312528,
        keywordIds: [312528],
        collectionIds: []
    },
    {
        name: 'DC Extended Universe (DCEU)',
        keywordId: 229266,
        keywordIds: [229266],
        collectionIds: []
    },
    {
        name: "Sony's Spider-Man Universe (SSU)",
        collectionIds: [558216]
    },
    {
        name: 'Star Wars Universe',
        collectionIds: [10, 302331, 133830]
    },
    {
        name: 'Star Trek Universe',
        keywordId: 327763,
        keywordIds: [327763],
        collectionIds: [151, 115570, 115575, 366179]
    },
    {
        name: 'Wizarding World',
        collectionIds: [1241, 435259]
    },
    {
        name: 'The MonsterVerse',
        collectionIds: [535313, 1539140]
    },
    {
        name: 'X-Men Cinematic Universe',
        collectionIds: [748, 453993, 448150]
    },
    {
        name: 'The Conjuring Universe',
        keywordIds: [323553],
        collectionIds: [313086, 402074, 968052]
    },
    {
        name: 'Spider-Man Expanded Universe',
        collectionIds: [556, 125574, 531241, 573436]
    },
    {
        name: "Tolkien's Middle-Earth",
        keywordIds: [361757, 361759],
        collectionIds: [119, 121938, 141290]
    },
    {
        name: 'Alien & Predator (AVP)',
        collectionIds: [8091, 399, 115762]
    },
    {
        name: 'The Walking Dead Universe',
        keywordIds: [207891]
    },
    {
        name: 'Doctor Who Universe',
        keywordIds: [363084],
        collectionIds: [275873]
    }
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
