/**
 * Universal Tracking Script
 * Captures UTM parameters, affiliate IDs, and referrer information
 * Works on all pages - stores in sessionStorage for signup
 */

(function() {
  // Only capture once per session
  if (sessionStorage.getItem('trackingCaptured')) {
    console.log('📊 Tracking already captured this session');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);

  const trackingData = {
    utm_source: urlParams.get('utm_source') || urlParams.get('source'),
    utm_medium: urlParams.get('utm_medium') || urlParams.get('medium'),
    utm_campaign: urlParams.get('utm_campaign') || urlParams.get('campaign'),
    utm_content: urlParams.get('utm_content'),
    utm_term: urlParams.get('utm_term'),
    affiliate_id: urlParams.get('ref') || urlParams.get('affiliate') || urlParams.get('aff'),
    referrer: document.referrer || null,
    landing_page: window.location.pathname + window.location.search
  };

  // Only store if we have at least one tracking parameter
  const hasTrackingData = trackingData.utm_source ||
                          trackingData.utm_medium ||
                          trackingData.utm_campaign ||
                          trackingData.affiliate_id ||
                          trackingData.referrer;

  if (hasTrackingData) {
    sessionStorage.setItem('trackingData', JSON.stringify(trackingData));
    sessionStorage.setItem('trackingCaptured', 'true');

    console.log('📊 Tracking data captured:', {
      source: trackingData.utm_source || 'organic',
      medium: trackingData.utm_medium || 'none',
      affiliate: trackingData.affiliate_id || 'none',
      referrer: trackingData.referrer ? new URL(trackingData.referrer).hostname : 'direct'
    });
  } else {
    console.log('📊 No tracking parameters found - organic/direct traffic');
  }
})();
