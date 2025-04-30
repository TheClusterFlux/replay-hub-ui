/**
 * Video player module for Replay Hub
 */

// Initialize the global replayHub object if needed
window.replayHub = window.replayHub || {};

// Initialize the module immediately
(function() {
  // Check if utils module is available
  if (!window.replayHub.utils) {
    console.error('Utils module not loaded - videoPlayer cannot initialize');
    return;
  }

  const { detectVideoType, showError } = window.replayHub.utils;

  /**
   * Initialize the video player with the given URL
   * @param {string} videoUrl - The URL of the video to play
   */
  function initVideoPlayer(videoUrl) {
    const videoPlayer = document.getElementById('video-player');
    const videoEmbed = document.getElementById('video-embed');
    
    if (!videoPlayer || !videoEmbed) {
      console.error("Video player elements not found in the DOM");
      showError("Video player elements not found");
      return;
    }
    
    // Validate URL
    if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim() === '') {
      showError('Invalid video URL');
      return;
    }
    
    // Ensure video URL is properly encoded
    try {
      const decodedUrl = decodeURIComponent(videoUrl);
      videoUrl = encodeURI(decodedUrl);
    } catch (e) {
      // Continue with the original URL if there's an error
    }
    
    // Check if this is an HLS stream
    const isHlsStream = videoUrl.toLowerCase().includes('.m3u8');
    const videoType = detectVideoType(videoUrl);
    
    try {
      if (window.videojs) {
        // Simple direct initialization
        videoPlayer.style.display = 'block';
        videoEmbed.style.display = 'none';
        
        // Dispose any existing player to avoid conflicts
        try {
          const existingPlayer = window.videojs.getPlayer('video-player');
          if (existingPlayer) existingPlayer.dispose();
        } catch (disposeErr) {
          // Continue anyway if no player to dispose
        }
        
        // Create a new videojs player using the ID string
        const player = window.videojs('video-player', {
          controls: true,
          autoplay: false,
          preload: 'auto',
          fluid: true
        });
        
        // Set the source
        player.src({
          src: videoUrl,
          type: videoType
        });
        
        // Handle errors
        player.on('error', function() {
          fallbackToIframe(videoUrl, videoPlayer, videoEmbed);
        });
      } else {
        // Fallback to native player if Video.js isn't available
        videoPlayer.style.display = 'block';
        videoEmbed.style.display = 'none';
        videoPlayer.src = videoUrl;
        
        videoPlayer.onerror = () => {
          fallbackToIframe(videoUrl, videoPlayer, videoEmbed);
        };
      }
    } catch (err) {
      console.error('Error setting up video player:', err);
      fallbackToIframe(videoUrl, videoPlayer, videoEmbed);
    }
  }

  /**
   * Fall back to iframe-based player if the main player fails
   * @param {string} videoUrl - The URL of the video
   * @param {HTMLElement} videoPlayer - The main video player element
   * @param {HTMLElement} videoEmbed - The iframe element
   */
  function fallbackToIframe(videoUrl, videoPlayer, videoEmbed) {
    if (videoPlayer) videoPlayer.style.display = 'none';
    if (videoEmbed) {
      videoEmbed.style.display = 'block';
      videoEmbed.src = videoUrl;
    }
  }

  // Export video player functions
  window.replayHub.videoPlayer = {
    initVideoPlayer
  };
  
  // Signal that this module is ready
  console.log('VideoPlayer module initialized');
})();