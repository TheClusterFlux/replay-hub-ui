/**
 * Main video page handler for Replay Hub
 * Uses modular architecture for better organization and maintainability
 */

// Video page initialization
function initVideoPage() {
  console.log("Initializing video page...");
  
  // Prevent double initialization
  if (window.videoPageInitialized) {
    return;
  }
  window.videoPageInitialized = true;
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const s3Url = urlParams.get('s3_url');
  const videoId = urlParams.get('id');
  
  if (!s3Url) {
    if (window.replayHub && window.replayHub.utils) {
      window.replayHub.utils.showError('No video URL provided');
    } else {
      console.error('No video URL provided and utils module not available');
      alert('Error: No video URL provided');
    }
    return;
  }
  
  // Start initializing immediately rather than waiting for DOMContentLoaded
  initializeVideoUI(s3Url, videoId);
}

/**
 * Initialize video player and metadata
 */
async function initializeVideoUI(s3Url, videoId) {
  try {
    // Wait to ensure modules are initialized
    await waitForModulesReady();
    
    const videoPlayer = document.getElementById('video-player');
    if (!videoPlayer) {
      showErrorMessage('Video player could not be loaded');
      return;
    }
    
    // Initialize video player
    if (window.videojs && window.replayHub.videoPlayer) {
      window.replayHub.videoPlayer.initVideoPlayer(s3Url);
    } else {
      showErrorMessage('Video player library failed to load');
      console.error('Missing dependencies:', {
        'videojs': !!window.videojs,
        'replayHub.videoPlayer': !!(window.replayHub && window.replayHub.videoPlayer)
      });
      return;
    }
    
    // Fetch and display video metadata if we have an ID
    if (videoId && window.replayHub.videoMetadata) {
      const videoData = await window.replayHub.videoMetadata.fetchVideoDetails(videoId);
      window.replayHub.videoMetadata.updateVideoUI(videoData);
      
      // Initialize comments and reactions
      if (window.replayHub.videoComments) {
        window.replayHub.videoComments.initComments(videoId);
        window.replayHub.videoComments.initReactions(videoId);
      } else {
        console.warn('Comments module not available');
      }
    } else {
      // Basic title from URL if no ID provided
      const videoTitle = document.getElementById('video-title');
      if (videoTitle && window.replayHub.utils) {
        const filename = s3Url.split('/').pop().split('?')[0];
        const prettyName = window.replayHub.utils.formatVideoTitle(filename);
        videoTitle.textContent = prettyName;
      }
    }
  } catch (err) {
    console.error("Error initializing video:", err);
    showErrorMessage('Error initializing video: ' + (err.message || 'Unknown error'));
  }
}

/**
 * Simple error message function that doesn't rely on modules
 * @param {string} message - Error message to display
 */
function showErrorMessage(message) {
  if (window.replayHub && window.replayHub.utils) {
    window.replayHub.utils.showError(message);
  } else {
    console.error("Error:", message);
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
      alert(message);
    }
  }
}

/**
 * Wait for all necessary modules to be ready
 * @returns {Promise} - Resolves when modules are ready
 */
function waitForModulesReady() {
  return new Promise((resolve) => {
    // Check if all modules are already initialized
    if (window.replayHub && 
        window.replayHub.utils && 
        window.replayHub.videoPlayer && 
        window.replayHub.videoMetadata && 
        window.replayHub.videoComments) {
      console.log('All modules already initialized');
      resolve();
      return;
    }
    
    console.log('Waiting for modules to initialize...');
    let waited = 0;
    
    // Check periodically with a short interval
    const checkInterval = setInterval(() => {
      waited += 100;
      
      // Log progress every second
      if (waited % 1000 === 0) {
        console.log(`Still waiting for modules (${waited}ms)`);
        console.log('Module status:', {
          utils: !!(window.replayHub && window.replayHub.utils),
          videoPlayer: !!(window.replayHub && window.replayHub.videoPlayer),
          videoMetadata: !!(window.replayHub && window.replayHub.videoMetadata),
          videoComments: !!(window.replayHub && window.replayHub.videoComments)
        });
      }
      
      if (window.replayHub && 
          window.replayHub.utils && 
          window.replayHub.videoPlayer && 
          window.replayHub.videoMetadata && 
          window.replayHub.videoComments) {
        clearInterval(checkInterval);
        clearTimeout(timeoutHandle);
        console.log(`All modules ready after ${waited}ms`);
        resolve();
      }
    }, 100);
    
    // Add a shorter timeout - don't wait too long
    const timeoutHandle = setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('Not all modules were loaded in time, proceeding anyway');
      resolve();
    }, 2000); // Wait max 2 seconds
  });
}

// Initialize the page as soon as possible
initVideoPage();