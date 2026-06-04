module.exports = {
    testEnvironment: 'node',
    testTimeout: 30000,
    // Ensures Jest exits cleanly even if open handles remain (e.g., Redis keep-alive sockets).
    // This is equivalent to passing --forceExit manually, but makes it the default.
    forceExit: true,
    // Surface any handles that prevent clean exit during development
    detectOpenHandles: false,
};
