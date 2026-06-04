const { isTitleMatch, wikiNormalize } = require('../src/utils/strings');

describe('isTitleMatch and isSafeSuffix', () => {
    it('should match exact titles', () => {
        expect(isTitleMatch('The Matrix', 'matrix')).toBe(true);
    });

    it('should match titles with safe suffixes', () => {
        expect(isTitleMatch('The Matrix bloopers', 'matrix')).toBe(true);
        expect(isTitleMatch('The Matrix outtakes', 'matrix')).toBe(true);
        expect(isTitleMatch('The Matrix 1999', 'matrix')).toBe(true);
    });

    it('should match titles with safe suffixes handling spaces', () => {
        expect(isTitleMatch('The Matrix   bloopers  ', 'matrix')).toBe(true);
        expect(isTitleMatch('  The Matrix blooper ', 'matrix')).toBe(true);
    });

    it('should return false for titles with invalid suffixes', () => {
        expect(isTitleMatch('The Matrix Reloaded', 'matrix')).toBe(false);
        expect(isTitleMatch('The Matrix invalid', 'matrix')).toBe(false);
        expect(isTitleMatch('The Matrix 1999a', 'matrix')).toBe(false);
    });

    it('should match titles with accented characters (diacritics)', () => {
        expect(isTitleMatch('Amélie', 'amelie')).toBe(true);
        expect(isTitleMatch('Wall·E', 'wall e')).toBe(true);
        expect(isTitleMatch('Mëll', 'mell')).toBe(true);
    });
});

describe('wikiNormalize', () => {
    it('should strip wikipedia bracketed citations and footnotes', () => {
        expect(wikiNormalize('Iron Man [1]')).toBe('ironman');
        expect(wikiNormalize('Finding Nemo [Note 1]')).toBe('findingnemo');
        expect(wikiNormalize('The Avengers [citation needed]')).toBe('avengers');
        expect(wikiNormalize('Guardians of the Galaxy [edit]')).toBe('guardiansofthegalaxy');
    });

    it('should handle standard normalizations', () => {
        expect(wikiNormalize('The Matrix (film)')).toBe('matrix');
        expect(wikiNormalize('Avatar, The')).toBe('avatar');
    });
});
