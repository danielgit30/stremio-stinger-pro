// Pre-compiled regexes
const RE_HTML_TAGS = /<[^>]*>?/gm;

const RE_YEAR = /\(\d{4}\)/g;
const RE_ARTICLE_START = /^(the|a|an)\s+/i;
const RE_WIKI_ARTICLE_END = /,\s*(the|a|an)$/i;
const RE_WIKI_PARENS = /\s*\(.*?\)\s*/g;
const RE_WIKI_NON_ALNUM = /[^a-z0-9]/g;
const RE_FOUR_DIGITS = /^\d{4}$/;

const BLOOPER_REGEX = /\b(bloopers?|outtakes?|gags?|gag reel)\b/;
const NEGATIVE_REGEX = /(no extra|no stinger|nothing|are no|no scene)/;
const STINGER_EXCEPTION_REGEX = /(extra shot|audio|voice|laugh|but|however)/;
const AC_BLOOPER_TAGS = new Set(['outtake', 'musical', 'blooper', 'humorous credit']);

const safeTokens = new Set([
    'blooper',
    'bloopers',
    'outtake',
    'outtakes',
    'extra',
    'extras',
    'and',
    'or',
    'with',
    'scene',
    'scenes',
    'credit',
    'credits',
    'stinger',
    'stingers',
    'review',
    'reviews',
    'post',
    'mid',
    'after',
    'end',
    'during',
    'the',
    'is',
    'a',
    'an',
    'there',
    'are',
    'movie',
    'film',
]);

const cleanTitle = (str) => {
    if (!str) return '';
    let i = 0;
    let len = str.length;
    let wordStart = -1;
    let words = [];

    for (; i < len; i++) {
        let code = str.charCodeAt(i);
        if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 95) {
            if (wordStart === -1) wordStart = i;
        } else {
            if (wordStart !== -1) {
                words.push(str.substring(wordStart, i));
                wordStart = -1;
            }
        }
    }
    if (wordStart !== -1) {
        words.push(str.substring(wordStart, len));
    }

    if (words.length === 0) return '';

    let start = 0;
    let end = words.length - 1;

    if (words.length > 1) {
        let first = words[0].toLowerCase();
        if (first === 'the' || first === 'a' || first === 'an') {
            start = 1;
        }
    }

    if (end > start) {
        let last = words[end].toLowerCase();
        if (last === 'the' || last === 'a' || last === 'an') {
            end--;
        }
    }

    let res = words[start];
    for (let j = start + 1; j <= end; j++) {
        res += ' ' + words[j];
    }
    return res;
};

const isSafeSuffix = (str) => {
    if (!str) return false;

    const trimmed = str.trim();
    if (!trimmed) return true;

    const words = trimmed.split(/\s+/);
    for (const word of words) {
        if (!safeTokens.has(word) && !RE_FOUR_DIGITS.test(word)) {
            return false;
        }
    }
    return true;
};

const isTitleMatch = (linkText, cleanedTargetTitle) => {
    let rawNoYear = linkText.toLowerCase().replace(RE_YEAR, '').trim();
    let tLink = cleanTitle(rawNoYear);

    if (tLink === cleanedTargetTitle) return true;

    if (cleanedTargetTitle.length > 0 && tLink.startsWith(cleanedTargetTitle)) {
        const remainder = tLink.substring(cleanedTargetTitle.length).trim();
        if (isSafeSuffix(remainder)) return true;

        let originalStripped = rawNoYear.replace(RE_ARTICLE_START, '').trim();
        if (
            originalStripped.startsWith(cleanedTargetTitle + ':') ||
            originalStripped.startsWith(cleanedTargetTitle + ' :')
        ) {
            return true;
        }
    }

    if (tLink.length > 0 && cleanedTargetTitle.startsWith(tLink)) {
        const remainder = cleanedTargetTitle.substring(tLink.length).trim();
        if (isSafeSuffix(remainder)) return true;
    }

    return false;
};

const wikiNormalize = (title) => {
    return title
        .toLowerCase()
        .replace(RE_ARTICLE_START, '')
        .replace(RE_WIKI_ARTICLE_END, '')
        .replace(RE_WIKI_PARENS, '')
        .replace(RE_WIKI_NON_ALNUM, '')
        .trim();
};

const decodeHtmlString = (html) => {
    if (!html) return '';
    let text = html.replace(RE_HTML_TAGS, '');
    if (text.indexOf('&') === -1) return text;

    let result = '';
    let lastIndex = 0;

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '&') {
            const semicolonIndex = text.indexOf(';', i + 1);
            if (semicolonIndex !== -1 && semicolonIndex - i <= 10) {
                const entity = text.substring(i + 1, semicolonIndex);
                let replacement = null;

                if (entity[0] === '#') {
                    if (entity[1] === 'x' || entity[1] === 'X') {
                        let valid = true;
                        for (let j = 2; j < entity.length; j++) {
                            const c = entity.charCodeAt(j);
                            if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70))) {
                                valid = false;
                                break;
                            }
                        }
                        if (valid && entity.length > 2) {
                            replacement = String.fromCharCode(parseInt(entity.substring(2), 16));
                        }
                    } else {
                        let valid = true;
                        for (let j = 1; j < entity.length; j++) {
                            const c = entity.charCodeAt(j);
                            if (!(c >= 48 && c <= 57)) {
                                valid = false;
                                break;
                            }
                        }
                        if (valid && entity.length > 1) {
                            replacement = String.fromCharCode(parseInt(entity.substring(1), 10));
                        }
                    }
                } else {
                    switch (entity) {
                        case 'amp':
                            replacement = '&';
                            break;
                        case 'quot':
                            replacement = '"';
                            break;
                        case 'lt':
                            replacement = '<';
                            break;
                        case 'gt':
                            replacement = '>';
                            break;
                        case 'nbsp':
                            replacement = ' ';
                            break;
                    }
                }

                if (replacement !== null) {
                    result += text.substring(lastIndex, i) + replacement;
                    lastIndex = semicolonIndex + 1;
                    i = semicolonIndex;
                }
            }
        }
    }

    return result + text.substring(lastIndex);
};

module.exports = {
    decodeHtmlString,
    cleanTitle,
    isTitleMatch,
    wikiNormalize,
    BLOOPER_REGEX,
    NEGATIVE_REGEX,
    STINGER_EXCEPTION_REGEX,
    AC_BLOOPER_TAGS,
};
