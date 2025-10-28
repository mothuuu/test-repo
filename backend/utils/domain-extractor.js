/**
 * Domain Extraction and Normalization Utility
 *
 * Handles domain extraction from URLs and comparison logic for
 * determining if a scan is against the primary domain or a competitor.
 *
 * Rules:
 * - xeo.com = www.xeo.com = app.xeo.com = blog.xeo.com (same root domain)
 * - Extracts root domain (removes www, subdomains)
 * - Normalizes for consistent comparison
 */

const { URL } = require('url');

/**
 * Extract root domain from a URL
 * Examples:
 * - https://www.xeo.com/page -> xeo.com
 * - https://app.xeo.com/dashboard -> xeo.com
 * - https://blog.xeo.com -> xeo.com
 * - https://xeo.com -> xeo.com
 *
 * @param {string} urlString - Full URL to extract domain from
 * @returns {string|null} Root domain or null if invalid
 */
function extractRootDomain(urlString) {
  try {
    // Parse URL
    const parsedUrl = new URL(urlString);
    let hostname = parsedUrl.hostname.toLowerCase();

    // Remove www prefix if present
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    // Split by dots
    const parts = hostname.split('.');

    // Handle different TLD cases
    if (parts.length >= 2) {
      // For most domains: example.com, example.co.uk, etc.
      // Take last 2 parts for standard TLDs (.com, .org, .net)
      // For country-code TLDs like .co.uk, this still works (co.uk)
      const rootDomain = parts.slice(-2).join('.');
      return rootDomain;
    }

    // If only one part (localhost), return as-is
    return hostname;
  } catch (error) {
    console.error('Error extracting domain from URL:', urlString, error.message);
    return null;
  }
}

/**
 * Check if two URLs belong to the same root domain
 *
 * @param {string} url1 - First URL
 * @param {string} url2 - Second URL
 * @returns {boolean} True if same root domain
 */
function isSameDomain(url1, url2) {
  const domain1 = extractRootDomain(url1);
  const domain2 = extractRootDomain(url2);

  if (!domain1 || !domain2) {
    return false;
  }

  return domain1 === domain2;
}

/**
 * Determine if a scan URL matches the user's primary domain
 *
 * @param {string} scanUrl - URL being scanned
 * @param {string} primaryDomain - User's primary root domain (e.g., "xeo.com")
 * @returns {boolean} True if scan URL matches primary domain
 */
function isPrimaryDomain(scanUrl, primaryDomain) {
  if (!primaryDomain) {
    return false; // No primary domain set yet
  }

  const scanDomain = extractRootDomain(scanUrl);

  if (!scanDomain) {
    return false;
  }

  // Normalize both for comparison
  return scanDomain.toLowerCase() === primaryDomain.toLowerCase();
}

/**
 * Get display-friendly domain name
 *
 * @param {string} urlString - Full URL
 * @returns {string} Display name (e.g., "xeo.com" or "www.example.com")
 */
function getDisplayDomain(urlString) {
  try {
    const parsedUrl = new URL(urlString);
    return parsedUrl.hostname.toLowerCase();
  } catch (error) {
    return urlString;
  }
}

/**
 * Validate that a URL is properly formatted
 *
 * @param {string} urlString - URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(urlString) {
  try {
    new URL(urlString);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  extractRootDomain,
  isSameDomain,
  isPrimaryDomain,
  getDisplayDomain,
  isValidUrl
};
