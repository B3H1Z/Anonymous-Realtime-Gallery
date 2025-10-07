/**
 * Google Analytics 4 Helper Functions
 * Provides utilities for tracking page views and custom events
 */

// Check if GA is available
const isGAAvailable = () => {
  return typeof window !== 'undefined' && 
         typeof window.gtag === 'function' && 
         window.GA_MEASUREMENT_ID &&
         window.GA_MEASUREMENT_ID !== '%VITE_GA_MEASUREMENT_ID%' &&
         !window.GA_MEASUREMENT_ID.includes('XXXXXXXXXX')
}

/**
 * Track page view
 * @param {string} path - The page path to track
 * @param {string} title - The page title
 */
export const trackPageView = (path, title = document.title) => {
  if (!isGAAvailable()) {
    console.log('[Analytics] GA not available - Page view:', path)
    return
  }

  try {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
      page_location: window.location.href
    })
    console.log('[Analytics] Page view tracked:', path)
  } catch (error) {
    console.error('[Analytics] Error tracking page view:', error)
  }
}

/**
 * Track custom event
 * @param {string} eventName - Name of the event
 * @param {object} eventParams - Parameters for the event
 */
export const trackEvent = (eventName, eventParams = {}) => {
  if (!isGAAvailable()) {
    console.log('[Analytics] GA not available - Event:', eventName, eventParams)
    return
  }

  try {
    window.gtag('event', eventName, eventParams)
    console.log('[Analytics] Event tracked:', eventName, eventParams)
  } catch (error) {
    console.error('[Analytics] Error tracking event:', error)
  }
}

/**
 * Pre-defined event tracking functions
 */

// Photo interactions
export const trackPhotoView = (photoId) => {
  trackEvent('photo_view', {
    photo_id: photoId,
    content_type: 'photo'
  })
}

export const trackPhotoLike = (photoId) => {
  trackEvent('photo_like', {
    photo_id: photoId,
    engagement_type: 'like'
  })
}

export const trackPhotoReport = (photoId, reason) => {
  trackEvent('photo_report', {
    photo_id: photoId,
    report_reason: reason,
    engagement_type: 'report'
  })
}

export const trackPhotoUpload = (success = true) => {
  trackEvent('photo_upload', {
    success: success,
    upload_type: 'user_generated_content'
  })
}

// Modal interactions
export const trackModalOpen = (modalName) => {
  trackEvent('modal_open', {
    modal_name: modalName
  })
}

export const trackModalClose = (modalName) => {
  trackEvent('modal_close', {
    modal_name: modalName
  })
}

// Authentication events
export const trackLogin = (method = 'default') => {
  trackEvent('login', {
    method: method
  })
}

export const trackLogout = () => {
  trackEvent('logout')
}

// Search and filter events
export const trackSearch = (searchTerm) => {
  trackEvent('search', {
    search_term: searchTerm
  })
}

export const trackFilterApply = (filterType, filterValue) => {
  trackEvent('filter_apply', {
    filter_type: filterType,
    filter_value: filterValue
  })
}

// Camera interactions
export const trackCameraStart = () => {
  trackEvent('camera_start', {
    interaction_type: 'camera'
  })
}

export const trackPhotoCapture = () => {
  trackEvent('photo_capture', {
    interaction_type: 'camera'
  })
}

export const trackPhotoRetake = () => {
  trackEvent('photo_retake', {
    interaction_type: 'camera'
  })
}

// Terms and policy
export const trackPolicyView = () => {
  trackEvent('policy_view', {
    content_type: 'legal'
  })
}

export const trackTermsView = () => {
  trackEvent('terms_view', {
    content_type: 'legal'
  })
}

// Share events
export const trackShare = (method, photoId = null) => {
  trackEvent('share', {
    method: method,
    photo_id: photoId,
    content_type: 'photo'
  })
}

// Error tracking
export const trackError = (errorType, errorMessage) => {
  trackEvent('error', {
    error_type: errorType,
    error_message: errorMessage,
    page_path: window.location.pathname
  })
}

export default {
  trackPageView,
  trackEvent,
  trackPhotoView,
  trackPhotoLike,
  trackPhotoReport,
  trackPhotoUpload,
  trackModalOpen,
  trackModalClose,
  trackLogin,
  trackLogout,
  trackSearch,
  trackFilterApply,
  trackCameraStart,
  trackPhotoCapture,
  trackPhotoRetake,
  trackPolicyView,
  trackTermsView,
  trackShare,
  trackError
}
