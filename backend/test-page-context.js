const test = require('node:test');
const assert = require('assert');
const { computePageSetHash } = require('./utils/page-context');

test('computePageSetHash produces stable hash regardless of order', () => {
  const first = computePageSetHash('https://example.com', [
    'https://example.com/about',
    'https://example.com/contact'
  ]);

  const second = computePageSetHash('https://example.com', [
    'https://example.com/contact',
    'https://example.com/about'
  ]);

  assert.strictEqual(first.pageSetHash, second.pageSetHash);
  assert.deepStrictEqual(first.normalizedPages, second.normalizedPages);
});

test('computePageSetHash drops invalid URLs', () => {
  const { normalizedPages } = computePageSetHash('https://example.com', ['not-a-url']);
  assert.deepStrictEqual(normalizedPages, ['https://example.com']);
});
