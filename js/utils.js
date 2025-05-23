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
 * @param {string} url - The URL of the video
 * @returns {string} - The MIME type
 */
function detectVideoType(url) {
  if (!url) return 'video/mp4'; // Default
  
  try {
    if (url.toLowerCase().includes('.m3u8')) {
      return 'application/x-mpegURL'; // HLS stream
    }
    
    if (url.toLowerCase().includes('.mpd')) {
      return 'application/dash+xml'; // DASH stream
    }
    
    const extension = url.split('.').pop().toLowerCase().split('?')[0];
    const mimeTypes = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogv': 'video/ogg',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'mkv': 'video/x-matroska'
    };
    
    return mimeTypes[extension] || 'video/mp4';
  } catch (e) {
    return 'video/mp4'; // Default to mp4
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