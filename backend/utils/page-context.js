const crypto = require('crypto');

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
    parsed.pathname = normalizedPath;
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/$/, '');
  } catch (e) {
    return null;
  }
}

function computePageSetHash(primaryUrl, pages = []) {
  const normalizedPages = [primaryUrl, ...(Array.isArray(pages) ? pages : [])]
    .map(normalizeUrl)
    .filter(Boolean);

  const uniquePages = Array.from(new Set(normalizedPages)).sort();

  const hash = crypto
    .createHash('sha256')
    .update(uniquePages.join('|'))
    .digest('hex');

  return { pageSetHash: hash, normalizedPages: uniquePages };
}

module.exports = {
  normalizeUrl,
  computePageSetHash
};
