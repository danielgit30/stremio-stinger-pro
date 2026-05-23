function sanitizeError(msg) {
    if (!msg) return '';
    let sanitized = String(msg).replace(/[\r\n]/g, ' ');
    return sanitized.replace(/api_key=[^&\s]+/gi, 'api_key=***');
}

/**
 * Security: Prevent SSRF by validating the URL before fetching
 */
function validateUrl(targetUrl, baseUrl, expectedHostname) {
    try {
        const parsedUrl = new URL(targetUrl, baseUrl);
        if (parsedUrl.hostname !== expectedHostname && parsedUrl.hostname !== `www.${expectedHostname}`) {
            console.warn(`[Security] Blocked untrusted URL: ${sanitizeError(targetUrl)}`);
            return null;
        }
        return parsedUrl.href;
    } catch (e) {
        console.warn(`[Security] Invalid URL format: ${sanitizeError(targetUrl)}`);
        return null;
    }
}

module.exports = {
    sanitizeError,
    validateUrl
};
