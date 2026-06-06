// Polyfill TextEncoder/TextDecoder for react-router-dom in the jsdom environment.
// Some versions of jsdom do not expose these globals even though they are
// available in Node. This file runs via jest.config.ts setupFiles before any
// test suite, so the polyfill is in place before any module import executes.
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
