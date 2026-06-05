const { ENABLE_LOGGING } = require('../config');
const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

const formatArgs = (args) => {
    return args
        .map((arg) =>
            typeof arg === 'object' && arg instanceof Error
                ? arg.stack || arg.message
                : typeof arg === 'object'
                  ? JSON.stringify(arg)
                  : arg
        )
        .join(' ');
};

const structuredLog = (severity, ...args) => {
    if (!ENABLE_LOGGING) return;

    const reqId = asyncLocalStorage.getStore() || 'SYS';

    if (process.env.NODE_ENV === 'production') {
        const message = formatArgs(args);
        const logMethod = severity === 'ERROR' ? 'error' : severity === 'WARNING' ? 'warn' : 'log';
        console[logMethod](
            JSON.stringify({
                reqId,
                severity,
                message,
                timestamp: new Date().toISOString(),
            })
        );
    } else {
        const timestamp = new Date().toISOString();
        if (severity === 'ERROR') {
            console.error(`[${timestamp}] [${reqId}] [ERROR]`, ...args);
        } else if (severity === 'WARNING') {
            console.warn(`[${timestamp}] [${reqId}] [WARN]`, ...args);
        } else {
            console.log(`[${timestamp}] [${reqId}]`, ...args);
        }
    }
};

const log = (...args) => structuredLog('INFO', ...args);
const warn = (...args) => structuredLog('WARNING', ...args);
const error = (...args) => structuredLog('ERROR', ...args);

module.exports = { log, warn, error, asyncLocalStorage };
