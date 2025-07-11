/**
 * Main video page handler for Replay Hub
 * Uses modular architecture for better organization and maintainability
 */

// Video page initialization
async function initVideoPage() {
  console.log("Initializing video page...");
  
  // Prevent double initialization
  if (window.videoPageInitialized) {
    return;
  }
  window.videoPageInitialized = true;
  
  // Show loading state
  showLoadingState();
  
  try {
    // Step 1: Initialize authentication completely first
    await initVideoPageAuth();
    
    // Step 2: Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const s3Url = urlParams.get('s3_url');
    const videoId = urlParams.get('id');
    
    // Step 3: Fetch video data if needed
    let videoData = null;
    if (videoId && !s3Url) {
      videoData = await initializeVideoFromId(videoId);
      if (!videoData) return; // Error already handled
    }
    
    // Step 4: Wait for all modules to be ready
    await waitForModulesReady();
    
    // Step 5: Initialize video with complete context (auth + data)
    await initializeVideoUI(s3Url || (videoData ? videoData.s3_url : null), videoId, videoData);
    
    // Step 6: Ensure meta tags are updated for social media sharing
    if (window.replayHub && window.replayHub.socialMediaMeta) {
      // Update meta tags with current URL even if no video data
      const currentUrl = window.location.href;
      window.replayHub.socialMediaMeta.updateMetaProperty('og:url', currentUrl);
      window.replayHub.socialMediaMeta.updateMetaName('twitter:player', currentUrl);
      window.replayHub.socialMediaMeta.updateCanonicalUrl(currentUrl);
    }
    
    console.log("✅ Video page initialization complete");
    
  } catch (error) {
    console.error("Video page initialization failed:", error);
    showErrorMessage('Failed to load video page: ' + (error.message || 'Unknown error'));
  } finally {
    hideLoadingState();
  }
}

/**
 * Show loading state to prevent multiple renders
 */
function showLoadingState() {
  // Hide video content initially to prevent flash
  const videoContainer = document.querySelector('.video-container');
  if (videoContainer) {
    videoContainer.style.opacity = '0.5';
    videoContainer.style.pointerEvents = 'none';
  }
  
  // Show loading indicator
  const videoTitle = document.getElementById('video-title');
  if (videoTitle) {
    videoTitle.textContent = 'Loading...';
  }
  
  const videoDescription = document.getElementById('video-description');
  if (videoDescription) {
    videoDescription.textContent = 'Loading video content...';
  }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const videoContainer = document.querySelector('.video-container');
  if (videoContainer) {
    videoContainer.style.opacity = '1';
    videoContainer.style.pointerEvents = 'auto';
  }
}

/**
 * Initialize authentication for video page
 */
async function initVideoPageAuth() {
  console.log("Initializing video page authentication...");
  
  // First wait for auth.js to complete its initialization
  const waitForAuthModule = () => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (window.replayHub && window.replayHub.auth && window.replayHub.authState !== undefined) {
          clearInterval(checkInterval);
          console.log('Auth module ready, state:', window.replayHub.authState);
          resolve();
        }
      }, 50);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('Auth module not ready, proceeding anyway');
        resolve();
      }, 5000);
    });
  };

  await waitForAuthModule();
  
  // Wait for app.js functions to be available
  const waitForAppJS = () => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (typeof initializeAuth === 'function' && 
            typeof initAuthButtons === 'function' && 
            typeof initUploadModal === 'function' &&
            typeof updateLoginStatus === 'function') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
      
      // Timeout after 3 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('app.js functions not available, proceeding without full auth initialization');
        resolve();
      }, 3000);
    });
  };

  await waitForAppJS();
  
  // Initialize authentication buttons and upload modal
  if (typeof initAuthButtons === 'function') {
    initAuthButtons();
    console.log('Auth buttons initialized');
  }
  
  if (typeof initUploadModal === 'function') {
    initUploadModal();
    console.log('Upload modal initialized');
  }
  
  // Check if we already have auth state from auth.js
  if (window.replayHub && window.replayHub.authState && window.replayHub.authState.isAuthenticated) {
    console.log('Using cached auth state from auth.js');
    if (typeof updateLoginStatus === 'function') {
      updateLoginStatus(true);
    }
  } else {
    // Initialize authentication state if not already cached
    if (typeof initializeAuth === 'function') {
      console.log('Initializing auth state...');
      const isAuthenticated = await initializeAuth();
      console.log('Auth initialization result:', isAuthenticated);
    } else {
      console.warn('initializeAuth function not available');
    }
  }
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
    
    return videoData;
    
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
          <p><strong>The video service is experiencing issues.</strong></p>
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
    
    return null;
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
      // Initialize video player - but only if we have a valid s3Url
    if (!s3Url) {
      console.error('Cannot initialize video player: s3Url is null or empty');
      showErrorMessage('Video URL not available. Please check the video link.');
      return;
    }
    
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
      
      // Update social media meta tags with video data
      if (window.replayHub.socialMediaMeta) {
        window.replayHub.socialMediaMeta.updateVideoMetaTags(videoData);
        window.replayHub.socialMediaMeta.addStructuredData(videoData);
      }
    } else if (videoId && window.replayHub.videoMetadata) {
      // Fetch and display video metadata if we have an ID but no data
      const fetchedVideoData = await window.replayHub.videoMetadata.fetchVideoDetails(videoId);
      window.replayHub.videoMetadata.updateVideoUI(fetchedVideoData);
      videoData = fetchedVideoData; // Store for later use
      
      // Update social media meta tags with fetched video data
      if (window.replayHub.socialMediaMeta && videoData) {
        window.replayHub.socialMediaMeta.updateVideoMetaTags(videoData);
        window.replayHub.socialMediaMeta.addStructuredData(videoData);
      }
    } else {
      // Basic title from URL if no ID provided
      const videoTitle = document.getElementById('video-title');
      if (videoTitle && window.replayHub.utils) {
        const filename = s3Url.split('/').pop().split('?')[0];
        const prettyName = window.replayHub.utils.formatVideoTitle(filename);
        videoTitle.textContent = prettyName;
        
        // Update social media meta tags with basic info for direct S3 URLs
        if (window.replayHub.socialMediaMeta) {
          const basicVideoData = {
            title: prettyName,
            description: `Watch ${prettyName} on Replay Hub`,
            s3_url: s3Url,
            uploader: 'Unknown'
          };
          window.replayHub.socialMediaMeta.updateVideoMetaTags(basicVideoData);
          window.replayHub.socialMediaMeta.addStructuredData(basicVideoData);
        }
      }
    }
    
    // Initialize comments and reactions if we have video data
    if (videoId && window.replayHub.videoComments) {
      window.replayHub.videoComments.initComments(videoId);
      window.replayHub.videoComments.initReactions(videoId);
      window.replayHub.videoComments.initSaveBookmark(videoId);
      window.replayHub.videoComments.initShare(videoId);
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

// Initialize the page when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVideoPage);
} else {
  // DOM is already ready
  initVideoPage();
}