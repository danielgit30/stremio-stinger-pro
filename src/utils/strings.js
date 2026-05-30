// Pre-compiled regexes
const RE_HTML_TAGS = /<[^>]*>?/gm;
const RE_DECIMAL_ENT = /&#(\d+);/g;
const RE_HEX_ENT = /&#x([0-9a-f]+);/gi;
const RE_AMP = /&amp;/g;
const RE_QUOT = /&quot;/g;
const RE_LT = /&lt;/g;
const RE_GT = /&gt;/g;
const RE_NBSP = /&nbsp;/g;

const RE_YEAR = /\(\d{4}\)/g;
const RE_NON_WORD = /[^\w\s]/g;
const RE_MULTI_SPACE = /\s+/g;
const RE_ARTICLE_START = /^(the|a|an)\s+/i;
const RE_ARTICLE_END = /\s+(the|a|an)$/i;
const RE_WIKI_ARTICLE_START = /^(the|a|an)\s+/i;
const RE_WIKI_ARTICLE_END = /,\s*(the|a|an)$/i;
const RE_WIKI_PARENS = /\s*\(.*?\)\s*/g;
const RE_WIKI_NON_ALNUM = /[^a-z0-9]/g;

const BLOOPER_REGEX = /\b(bloopers?|outtakes?|gags?|gag reel)\b/;
const NEGATIVE_REGEX = /(no extra|no stinger|nothing|are no|no scene)/;
const STINGER_EXCEPTION_REGEX = /(extra shot|audio|voice|laugh|but|however)/;
const AC_BLOOPER_TAGS = new Set(['outtake', 'musical', 'blooper', 'humorous credit']);

const safeTokens = new Set([
    'blooper', 'bloopers', 'outtake', 'outtakes', 'extra', 'extras', 'and', 'or', 'with',
    'scene', 'scenes', 'credit', 'credits', 'stinger', 'stingers', 'review', 'reviews',
    'post', 'mid', 'after', 'end', 'during', 'the', 'is', 'a', 'an', 'there', 'are', 'movie', 'film'
]);

const cleanTitle = (str) => {
    let s = str.replace(RE_NON_WORD, ' ').replace(RE_MULTI_SPACE, ' ').trim();
    return s.replace(RE_ARTICLE_START, '').replace(RE_ARTICLE_END, '').trim();
};

const isSafeSuffix = (str) => {
    if (!str) return false;
    let start = 0;
    const len = str.length;

    while (start < len) {
        let code = str.charCodeAt(start);
        if (code === 32 || (code >= 9 && code <= 13)) {
            start++;
            continue;
        }

        let end = start + 1;
        while (end < len) {
            code = str.charCodeAt(end);
            if (code === 32 || (code >= 9 && code <= 13)) {
                break;
            }
            end++;
        }

        const word = str.substring(start, end);
        if (!safeTokens.has(word)) {
            return false;
        }
        start = end + 1;
    }
    return true;
};

const isTitleMatch = (linkText, cleanedTargetTitle) => {
    let tLink = linkText.toLowerCase().replace(RE_YEAR, '').trim();
    tLink = cleanTitle(tLink);

    if (tLink === cleanedTargetTitle) return true;

    if (cleanedTargetTitle.length > 0 && tLink.startsWith(cleanedTargetTitle)) {
        const remainder = tLink.substring(cleanedTargetTitle.length).trim();
        if (isSafeSuffix(remainder)) return true;
    }

    if (tLink.length > 0 && cleanedTargetTitle.startsWith(tLink)) {
        const remainder = cleanedTargetTitle.substring(tLink.length).trim();
        if (isSafeSuffix(remainder)) return true;
    }

    return false;
};

const wikiNormalize = (title) => {
    return title.toLowerCase()
        .replace(RE_WIKI_ARTICLE_START, '')
        .replace(RE_WIKI_ARTICLE_END, '')
        .replace(RE_WIKI_PARENS, '')
        .replace(RE_WIKI_NON_ALNUM, '')
        .trim();
};


const decodeHtmlString = (html) => {
    if (!html) return '';
    let text = html.replace(RE_HTML_TAGS, '');
    return text
        .replace(RE_DECIMAL_ENT, (match, dec) => String.fromCharCode(dec))
        .replace(RE_AMP, '&')
        .replace(RE_QUOT, '"')
        .replace(RE_LT, '<')
        .replace(RE_GT, '>')
        .replace(RE_NBSP, ' ')
        .replace(RE_HEX_ENT, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
};

module.exports = {
    decodeHtmlString,
    cleanTitle,
    isTitleMatch,
    wikiNormalize,
    BLOOPER_REGEX,
    NEGATIVE_REGEX,
    STINGER_EXCEPTION_REGEX,
    AC_BLOOPER_TAGS
};
