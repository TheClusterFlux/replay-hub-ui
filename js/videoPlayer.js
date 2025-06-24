/**
 * Modern video player module for Replay Hub using Plyr
 * Provides better browser compatibility and S3 video support
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
  
  let currentPlayer = null;
  let currentHls = null;

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
    
    console.log('Initializing video player with URL:', videoUrl);
    
    // Clean up any existing player
    cleanupPlayer();
    
    // Ensure video URL is properly encoded but preserve S3 signatures
    let processedUrl = videoUrl.trim();
    
    try {
      // Check if this is an HLS stream
      const isHlsStream = processedUrl.toLowerCase().includes('.m3u8');
      const videoType = detectVideoType(processedUrl);
      
      console.log('Video type detected:', videoType, 'HLS:', isHlsStream);
      
      // Show video player, hide embed
      videoPlayer.style.display = 'block';
      videoEmbed.style.display = 'none';
      
      if (isHlsStream && window.Hls && Hls.isSupported()) {
        // Use HLS.js for HLS streams
        initHlsPlayer(videoPlayer, processedUrl);
      } else {
        // Use direct video source
        initDirectPlayer(videoPlayer, processedUrl, videoType);
      }
      
    } catch (err) {
      console.error('Error setting up video player:', err);
      fallbackToIframe(processedUrl, videoPlayer, videoEmbed);
    }
  }

  /**
   * Initialize HLS player using HLS.js
   * @param {HTMLElement} videoElement - The video element
   * @param {string} videoUrl - The HLS stream URL
   */
  function initHlsPlayer(videoElement, videoUrl) {
    if (!window.Hls || !Hls.isSupported()) {
      console.warn('HLS not supported, falling back to direct player');
      initDirectPlayer(videoElement, videoUrl, 'application/vnd.apple.mpegurl');
      return;
    }
    
    try {
      currentHls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90
      });
      
      currentHls.loadSource(videoUrl);
      currentHls.attachMedia(videoElement);
      
      currentHls.on(Hls.Events.MANIFEST_PARSED, function() {
        console.log('HLS manifest parsed successfully');
        initPlyrPlayer(videoElement);
      });
      
      currentHls.on(Hls.Events.ERROR, function(event, data) {
        console.error('HLS error:', data);
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error encountered, trying to recover');
              currentHls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error encountered, trying to recover');
              currentHls.recoverMediaError();
              break;
            default:
              console.error('Fatal error, cannot recover');
              fallbackToDirectPlayer(videoElement, videoUrl);
              break;
          }
        }
      });
      
    } catch (error) {
      console.error('Error initializing HLS player:', error);
      fallbackToDirectPlayer(videoElement, videoUrl);
    }
  }

  /**
   * Initialize direct video player
   * @param {HTMLElement} videoElement - The video element
   * @param {string} videoUrl - The video URL
   * @param {string} videoType - The MIME type
   */
  function initDirectPlayer(videoElement, videoUrl, videoType) {
    try {
      // Set video source
      videoElement.src = videoUrl;
      if (videoType) {
        // Create source element for better browser compatibility
        videoElement.innerHTML = `<source src="${videoUrl}" type="${videoType}">`;
      }
      
      // Add error handling
      videoElement.onerror = function(e) {
        console.error('Video error:', e);
        const videoEmbed = document.getElementById('video-embed');
        fallbackToIframe(videoUrl, videoElement, videoEmbed);
      };
      
      videoElement.onloadedmetadata = function() {
        console.log('Video metadata loaded successfully');
      };
      
      // Initialize Plyr player
      initPlyrPlayer(videoElement);
      
    } catch (error) {
      console.error('Error setting up direct player:', error);
      const videoEmbed = document.getElementById('video-embed');
      fallbackToIframe(videoUrl, videoElement, videoEmbed);
    }
  }

  /**
   * Initialize Plyr player with custom configuration
   * @param {HTMLElement} videoElement - The video element
   */
  function initPlyrPlayer(videoElement) {
    if (!window.Plyr) {
      console.warn('Plyr not available, using native controls');
      return;
    }
    
    try {
      // Plyr configuration optimized for S3 videos
      const plyrConfig = {
        controls: [
          'play-large',
          'play',
          'progress', 
          'current-time',
          'duration',
          'mute',
          'volume',
          'settings',
          'fullscreen'
        ],
        settings: ['quality', 'speed'],
        quality: {
          default: 'auto',
          options: ['auto', 1080, 720, 480, 360]
        },
        speed: {
          selected: 1,
          options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
        },
        ratio: '16:9',
        loadSprite: true,
        iconUrl: 'https://cdn.plyr.io/3.7.8/plyr.svg',
        blankVideo: 'https://cdn.plyr.io/static/blank.mp4',
        crossorigin: true,
        preload: 'metadata'
      };
      
      currentPlayer = new Plyr(videoElement, plyrConfig);
      
      // Add event listeners
      currentPlayer.on('ready', () => {
        console.log('Plyr player ready');
      });
      
      currentPlayer.on('error', (event) => {
        console.error('Plyr error:', event);
        const videoEmbed = document.getElementById('video-embed');
        fallbackToIframe(videoElement.src || videoElement.currentSrc, videoElement, videoEmbed);
      });
      
      currentPlayer.on('loadstart', () => {
        console.log('Video loading started');
      });
      
      currentPlayer.on('canplay', () => {
        console.log('Video can start playing');
      });
      
      currentPlayer.on('loadeddata', () => {
        console.log('Video data loaded');
      });
      
    } catch (error) {
      console.error('Error initializing Plyr:', error);
      // Continue with native controls if Plyr fails
    }
  }

  /**
   * Fallback to direct player when HLS fails
   * @param {HTMLElement} videoElement - The video element
   * @param {string} videoUrl - The video URL
   */
  function fallbackToDirectPlayer(videoElement, videoUrl) {
    console.log('Falling back to direct player');
    cleanupHls();
    
    const videoType = detectVideoType(videoUrl);
    initDirectPlayer(videoElement, videoUrl, videoType);
  }

  /**
   * Fall back to iframe-based player if the main player fails
   * @param {string} videoUrl - The URL of the video
   * @param {HTMLElement} videoPlayer - The main video player element
   * @param {HTMLElement} videoEmbed - The iframe element
   */
  function fallbackToIframe(videoUrl, videoPlayer, videoEmbed) {
    console.log('Falling back to iframe player');
    cleanupPlayer();
    
    if (videoPlayer) videoPlayer.style.display = 'none';
    if (videoEmbed) {
      videoEmbed.style.display = 'block';
      videoEmbed.src = videoUrl;
    }
  }

  /**
   * Clean up current player instance
   */
  function cleanupPlayer() {
    cleanupHls();
    cleanupPlyr();
  }

  /**
   * Clean up HLS instance
   */
  function cleanupHls() {
    if (currentHls) {
      try {
        currentHls.destroy();
      } catch (error) {
        console.warn('Error destroying HLS instance:', error);
      }
      currentHls = null;
    }
  }

  /**
   * Clean up Plyr instance
   */
  function cleanupPlyr() {
    if (currentPlayer) {
      try {
        currentPlayer.destroy();
      } catch (error) {
        console.warn('Error destroying Plyr instance:', error);
      }
      currentPlayer = null;
    }
  }

  /**
   * Get current player instance (for external access)
   * @returns {Object|null} Current Plyr player instance
   */
  function getCurrentPlayer() {
    return currentPlayer;
  }

  // Export video player functions
  window.replayHub.videoPlayer = {
    initVideoPlayer,
    getCurrentPlayer,
    cleanupPlayer
  };
  
  // Clean up on page unload
  window.addEventListener('beforeunload', cleanupPlayer);
  
  // Signal that this module is ready
  console.log('VideoPlayer module initialized with Plyr');
})();