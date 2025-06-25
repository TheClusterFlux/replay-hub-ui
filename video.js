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
  
  // If we have an ID but no s3_url, fetch the video metadata first
  if (videoId && !s3Url) {
    initializeVideoFromId(videoId);
    return;
  }
  
  // Start initializing immediately rather than waiting for DOMContentLoaded
  initializeVideoUI(s3Url, videoId);
}

/**
 * Initialize video from ID by fetching metadata first
 */
async function initializeVideoFromId(videoId) {
  try {
    console.log('Fetching video metadata for ID:', videoId);
    console.log('Using BASE_URL:', window.BASE_URL);
    
    const metadataUrl = `${window.BASE_URL}/metadata/${videoId}`;
    console.log('Fetching from URL:', metadataUrl);
    
    // Fetch video metadata with detailed error handling
    const response = await fetch(metadataUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Metadata fetch response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      url: response.url
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Video with ID "${videoId}" not found in database`);
      } else if (response.status === 500) {
        throw new Error(`Server error (${response.status}): Backend service may be down`);
      } else {
        throw new Error(`Failed to fetch video metadata: ${response.status} ${response.statusText}`);
      }
    }
    
    const videoData = await response.json();
    console.log('Video metadata fetched:', videoData);
    
    if (!videoData) {
      throw new Error('No video data returned from server');
    }
    
    if (!videoData.s3_url) {
      throw new Error('Video metadata is missing S3 URL');
    }
    
    // Initialize with the fetched s3_url and full video data
    initializeVideoUI(videoData.s3_url, videoId, videoData);
    
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    
    let errorMessage = 'Video not found or failed to load';
    let detailedError = '';
    
    // Provide more specific error messages
    if (error.message && error.message.includes('NetworkError')) {
      errorMessage = 'Cannot connect to video service';
      detailedError = `
        <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0; text-align: left;">
          <h4>🌐 Connection Issue</h4>
          <p><strong>Cannot reach the backend service.</strong></p>
          <p>Attempted URL: <code>${window.BASE_URL}/metadata/${videoId}</code></p>
          <h5>Possible causes:</h5>
          <ul>
            <li>Backend service is not running</li>
            <li>Network connectivity issues</li>
            <li>Incorrect BASE_URL configuration</li>
            <li>Firewall blocking the connection</li>
          </ul>
        </div>
      `;
    } else if (error.message && error.message.includes('not found')) {
      errorMessage = 'Video not found';
      detailedError = `
        <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0; text-align: left;">
          <h4>📹 Video Not Found</h4>
          <p>Video ID "<code>${videoId}</code>" does not exist in the database.</p>
          <p>This could mean:</p>
          <ul>
            <li>The video was deleted</li>
            <li>The video ID is incorrect</li>
            <li>The database is not properly synchronized</li>
          </ul>
        </div>
      `;
    } else if (error.message && error.message.includes('Server error')) {
      errorMessage = 'Server error';
      detailedError = `
        <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0; text-align: left;">
          <h4>🔧 Server Error</h4>
          <p><strong>The backend service encountered an error.</strong></p>
          <p>This usually means there's an issue with the server configuration or database connection.</p>
        </div>
      `;
    }
    
    // Show enhanced error message
    if (window.replayHub && window.replayHub.utils) {
      const main = document.querySelector('main') || document.querySelector('.video-container');
      if (main && detailedError) {
        main.innerHTML = `
          <div class="error-message">
            <h2>Error</h2>
            <p>${errorMessage}</p>
            ${detailedError}
            <div style="margin-top: 20px;">
              <button onclick="window.location.reload()" style="
                background: #007cba;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                margin: 5px;
              ">Retry</button>
              <a href="index.html" style="
                background: #6c757d;
                color: white;
                text-decoration: none;
                padding: 10px 20px;
                border-radius: 4px;
                margin: 5px;
                display: inline-block;
              ">Back to Home</a>
            </div>
          </div>
        `;
      } else {
        window.replayHub.utils.showError(errorMessage);
      }
    } else {
      alert(`Error: ${errorMessage}`);
    }
  }
}

/**
 * Initialize video player and metadata
 */
async function initializeVideoUI(s3Url, videoId, videoData = null) {
  try {
    // Wait to ensure modules are initialized
    await waitForModulesReady();
    
    const videoPlayer = document.getElementById('video-player');
    if (!videoPlayer) {
      showErrorMessage('Video player could not be loaded');
      return;
    }
      // Initialize video player
    if (window.Plyr && window.replayHub.videoPlayer) {
      window.replayHub.videoPlayer.initVideoPlayer(s3Url);
    } else {
      showErrorMessage('Video player library failed to load');
      console.error('Missing dependencies:', {
        'Plyr': !!window.Plyr,
        'replayHub.videoPlayer': !!(window.replayHub && window.replayHub.videoPlayer)
      });
      return;
    }
    
    // Use pre-fetched video data if available, otherwise fetch it
    if (videoData) {
      // Update UI with the data we already have
      if (window.replayHub.videoMetadata) {
        window.replayHub.videoMetadata.updateVideoUI(videoData);
      }
    } else if (videoId && window.replayHub.videoMetadata) {
      // Fetch and display video metadata if we have an ID but no data
      const fetchedVideoData = await window.replayHub.videoMetadata.fetchVideoDetails(videoId);
      window.replayHub.videoMetadata.updateVideoUI(fetchedVideoData);
      videoData = fetchedVideoData; // Store for later use
    } else {
      // Basic title from URL if no ID provided
      const videoTitle = document.getElementById('video-title');
      if (videoTitle && window.replayHub.utils) {
        const filename = s3Url.split('/').pop().split('?')[0];
        const prettyName = window.replayHub.utils.formatVideoTitle(filename);
        videoTitle.textContent = prettyName;
      }
    }
    
    // Initialize comments and reactions if we have video data
    if (videoId && window.replayHub.videoComments) {
      window.replayHub.videoComments.initComments(videoId);
      window.replayHub.videoComments.initReactions(videoId);
    } else if (videoId) {
      console.warn('Comments module not available');
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