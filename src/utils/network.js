const axios = require('axios');
const { warn } = require('./logger');

// Global Axios Retry Interceptor for transient network/5xx errors
axios.interceptors.response.use(undefined, (err) => {
    const config = err.config;
    if (!config) return Promise.reject(err);

    config.retryCount = config.retryCount || 0;
    const shouldRetry =
        (err.response && [502, 503, 504].includes(err.response.status)) ||
        ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND'].includes(err.code);

    if (shouldRetry && config.retryCount < 2) {
        config.retryCount += 1;
        warn(`[Network] Transient error (${err.message}). Retrying attempt ${config.retryCount} for ${config.url}`);
        return new Promise((resolve) => setTimeout(() => resolve(axios(config)), 500 * config.retryCount));
    }
    return Promise.reject(err);
});

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
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            warn(`[Security] Blocked untrusted protocol: ${sanitizeError(parsedUrl.protocol)}`);
            return null;
        }
        if (parsedUrl.hostname !== expectedHostname && parsedUrl.hostname !== `www.${expectedHostname}`) {
            warn(`[Security] Blocked untrusted URL: ${sanitizeError(targetUrl)}`);
            return null;
        }
        return parsedUrl.href;
    } catch {
        warn(`[Security] Invalid URL format: ${sanitizeError(targetUrl)}`);
        return null;
    }
}

module.exports = {
    sanitizeError,
    validateUrl,
};
