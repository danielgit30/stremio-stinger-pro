const axios = require('axios');
const { axiosConfig } = require('../config');
const { warn } = require('./logger');

// Create a named Axios instance with centralized defaults (keep-alive agents, User-Agent, timeout).
// Scoping the retry interceptor to this instance — rather than the global axios — ensures that
// third-party libraries or future additions never inherit retry behavior unintentionally.
// All scrapers and route handlers import axiosInstance from this module instead of requiring 'axios' directly.
const axiosInstance = axios.create({
    headers: axiosConfig.headers,
    httpAgent: axiosConfig.httpAgent,
    httpsAgent: axiosConfig.httpsAgent,
    timeout: axiosConfig.timeout,
});

// Retry interceptor — scoped to axiosInstance only (does NOT patch global axios)
axiosInstance.interceptors.response.use(undefined, (err) => {
    const config = err.config;
    if (!config) return Promise.reject(err);

    config.retryCount = config.retryCount || 0;
    const shouldRetry =
        !axios.isCancel(err) &&
        ((err.response && [502, 503, 504].includes(err.response.status)) ||
            ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND'].includes(err.code));

    if (shouldRetry && config.retryCount < 2) {
        config.retryCount += 1;
        warn(`[Network] Transient error (${err.message}). Retrying attempt ${config.retryCount} for ${config.url}`);
        return new Promise((resolve) => setTimeout(() => resolve(axiosInstance(config)), 500 * config.retryCount));
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

// isCancel is a static method on the global axios module; custom instances don't inherit it.
// Re-exporting it here keeps callers decoupled from the global axios import.
module.exports = {
    axiosInstance,
    isCancel: axios.isCancel.bind(axios),
    sanitizeError,
    validateUrl,
};
