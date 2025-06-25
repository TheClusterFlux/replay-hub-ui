/**
 * Utility functions for the Replay Hub UI
 */

// Initialize the global replayHub object
window.replayHub = window.replayHub || {};

// Get the BASE_URL from app.js or use default
const UTILS_BASE_URL = window.BASE_URL || 'https://replay-hub.theclusterflux.com';

/**
 * Format view counts (e.g., 1.2K, 3.4M)
 * @param {number} count - The count to format
 * @returns {string} - Formatted count
 */
function formatViews(count) {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Format date to a readable format
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(date).toLocaleDateString(undefined, options);
}

/**
 * Format a filename to be more readable as a video title
 * @param {string} filename - The raw filename
 * @returns {string} - A formatted title
 */
function formatVideoTitle(filename) {
  if (!filename) return 'Video';
  
  // Decode URL components
  try {
    filename = decodeURIComponent(filename);
  } catch (e) {
    // If decoding fails, use as is
  }
  
  // Remove file extension
  filename = filename.split('.')[0] || filename;
  
  // Replace underscores, hyphens, and plus signs with spaces
  filename = filename.replace(/[_\-+]/g, ' ');
  
  // Clean up multiple spaces
  filename = filename.replace(/\s\s+/g, ' ').trim();
  
  // Capitalize first letter of each word for a nicer title
  filename = filename.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
  
  return filename;
}

/**
 * Detect the MIME type of a video based on its URL
 * Enhanced for better S3 and streaming compatibility with codec specifications
 * @param {string} url - The URL of the video
 * @returns {string} - The MIME type with codec specifications when possible
 */
function detectVideoType(url) {
  if (!url) return 'video/mp4'; // Default
  
  try {
    const lowercaseUrl = url.toLowerCase();
    
    // Check for streaming formats first
    if (lowercaseUrl.includes('.m3u8')) {
      return 'application/vnd.apple.mpegurl'; // HLS stream
    }
    
    if (lowercaseUrl.includes('.mpd')) {
      return 'application/dash+xml'; // DASH stream
    }
    
    // For S3 URLs, be more aggressive about format detection
    const isS3 = url.includes('amazonaws.com') || url.includes('s3.') || url.includes('.s3.') || url.includes('s3-');
    
    // Extract file extension, handling query parameters and S3 URLs
    let extension = '';
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('.');
      if (parts.length > 1) {
        extension = parts.pop().toLowerCase();
      }
    } catch (e) {
      // Fallback to simple extension extraction
      const parts = url.split('.');
      if (parts.length > 1) {
        extension = parts.pop().toLowerCase().split('?')[0].split('#')[0];
      }
    }
    
    // If no extension found, try to detect from URL patterns (especially for S3)
    if (!extension) {
      if (lowercaseUrl.includes('mp4') || lowercaseUrl.includes('.mp4')) extension = 'mp4';
      else if (lowercaseUrl.includes('webm') || lowercaseUrl.includes('.webm')) extension = 'webm';
      else if (lowercaseUrl.includes('mov') || lowercaseUrl.includes('.mov')) extension = 'mov';
      else if (lowercaseUrl.includes('avi') || lowercaseUrl.includes('.avi')) extension = 'avi';
      else if (lowercaseUrl.includes('mkv') || lowercaseUrl.includes('.mkv')) extension = 'mkv';
      else if (lowercaseUrl.includes('flv') || lowercaseUrl.includes('.flv')) extension = 'flv';
    }
    
    // Comprehensive MIME type mapping with codec specifications for common formats
    const mimeTypes = {
      // MP4 variants (most common) - return with codec specification for better compatibility
      'mp4': 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
      'm4v': 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
      
      // WebM variants
      'webm': 'video/webm; codecs="vp8, vorbis"',
      
      // Other formats (without codec specifications as they're less standardized)
      'ogv': 'video/ogg',
      'ogg': 'video/ogg',
      'mov': 'video/quicktime',
      'qt': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'wmv': 'video/x-ms-wmv',
      'asf': 'video/x-ms-asf',
      'flv': 'video/x-flv',
      'f4v': 'video/x-f4v',
      'mkv': 'video/x-matroska',
      'mka': 'video/x-matroska',
      '3gp': 'video/3gpp',
      '3g2': 'video/3gpp2',
      'mts': 'video/mp2t',
      'ts': 'video/mp2t',
      'vob': 'video/dvd'
    };
    
    const detectedType = mimeTypes[extension];
    if (detectedType) {
      console.log(`Detected video type: ${detectedType} (from extension: ${extension})`);
      return detectedType;
    }
    
    // Default fallback with codec specification for maximum compatibility
    console.log('No specific format detected, defaulting to MP4 with codecs');
    return 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    
  } catch (e) {
    console.warn('Error detecting video type:', e);
    return 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'; // Default with codecs
  }
}

/**
 * Extract a UUID from a string
 * @param {string} str - The string to search for a UUID
 * @returns {string|null} - The extracted UUID or null if not found
 */
function extractUUID(str) {
  if (!str) return null;
  
  // Look for a UUID pattern - with or without dashes
  const uuidMatch = str.match(/([a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12})|([a-f0-9]{32})/i);
  if (uuidMatch) {
    return uuidMatch[0];
  }
  return null;
}

/**
 * Display error messages to the user
 * @param {string} message - The error message to display
 */
function showError(message) {
  const main = document.querySelector('main') || document.querySelector('.video-container');
  if (main) {
    main.innerHTML = `
      <div class="error-message">
        <h2>Error</h2>
        <p>${message}</p>
        <a href="index.html">Back to Home</a>
      </div>
    `;
  } else {
    // As a last resort, use alert
    alert(message);
  }
  console.error("Error:", message);
}

// Export utilities to be used in other modules
window.replayHub.utils = {
  BASE_URL: UTILS_BASE_URL,
  formatViews,
  formatDate,
  formatVideoTitle,
  detectVideoType,
  extractUUID,
  showError
};

// If we have a currentUser already set from a login process, use it
if (window.currentUser && !window.replayHub.currentUser) {
  window.replayHub.currentUser = window.currentUser;
}

// Signal that this module is ready
console.log('Utils module initialized');