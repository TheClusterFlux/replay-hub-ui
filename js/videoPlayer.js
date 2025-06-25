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
   * Log detailed video element state for debugging
   * @param {HTMLElement} videoElement - The video element
   * @param {string} context - Context label for the log
   */
  function logVideoElementState(videoElement, context = 'DEBUG') {
    const networkStates = {
      0: 'NETWORK_EMPTY',
      1: 'NETWORK_IDLE', 
      2: 'NETWORK_LOADING',
      3: 'NETWORK_NO_SOURCE'
    };
    
    const readyStates = {
      0: 'HAVE_NOTHING',
      1: 'HAVE_METADATA',
      2: 'HAVE_CURRENT_DATA',
      3: 'HAVE_FUTURE_DATA',
      4: 'HAVE_ENOUGH_DATA'
    };
    
    const errorCodes = {
      1: 'MEDIA_ERR_ABORTED - The video download was aborted',
      2: 'MEDIA_ERR_NETWORK - A network error occurred',
      3: 'MEDIA_ERR_DECODE - The video is corrupted or not supported',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - No video with supported format and MIME type found'
    };
    
    console.group(`🎥 Video Element State [${context}]`);
    console.log('Network State:', `${networkStates[videoElement.networkState]} (${videoElement.networkState})`);
    console.log('Ready State:', `${readyStates[videoElement.readyState]} (${videoElement.readyState})`);
    console.log('Current Source:', videoElement.currentSrc || videoElement.src);
    console.log('Duration:', videoElement.duration);
    console.log('Dimensions:', `${videoElement.videoWidth}x${videoElement.videoHeight}`);
    
    if (videoElement.error) {
      console.error('Error Code:', `${errorCodes[videoElement.error.code]} (${videoElement.error.code})`);
      console.error('Error Message:', videoElement.error.message);
    }
    
    // Log all source elements
    const sources = videoElement.querySelectorAll('source');
    if (sources.length > 0) {
      console.log('Source Elements:');
      sources.forEach((source, index) => {
        console.log(`  ${index + 1}. ${source.src} (${source.type || 'no type'})`);
      });
    }
    
    console.groupEnd();
  }
  /**
   * Test video URL accessibility before attempting to play
   * @param {string} videoUrl - The video URL to test
   * @returns {Promise<boolean>} - Whether the URL is accessible
   */
  async function testVideoAccessibility(videoUrl) {
    try {
      console.log('Testing video URL accessibility:', videoUrl);
      
      const response = await fetch(videoUrl, {
        method: 'HEAD',
        mode: 'cors',
        headers: {
          'Range': 'bytes=0-1024' // Request only first 1KB to test accessibility
        }
      });
      
      console.log('Video URL test response:', {
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        acceptRanges: response.headers.get('accept-ranges'),
        cacheControl: response.headers.get('cache-control'),
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
        corsHeaders: {
          'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
          'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
          'access-control-allow-headers': response.headers.get('access-control-allow-headers')
        }
      });
      
      // Check if S3 returned a proper Content-Type
      const contentType = response.headers.get('content-type');
      if (isS3Url(videoUrl) && contentType) {
        console.log('S3 Content-Type detected:', contentType);
        if (!contentType.startsWith('video/') && !contentType.includes('octet-stream')) {
          console.warn('S3 file may not have correct Content-Type header:', contentType);
        }
      }
      
      return response.ok;
    } catch (error) {
      console.warn('Video URL accessibility test failed:', error);
      // For S3 CORS issues, don't fail completely
      if (error.message && error.message.includes('CORS')) {
        console.log('CORS error detected - this is common with S3, video might still work');
      }
      // Don't fail completely, might still work with video element
      return true;
    }
  }
  /**
   * Initialize the video player with the given URL
   * @param {string} videoUrl - The URL of the video to play
   */
  async function initVideoPlayer(videoUrl) {
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
    
    // For S3 URLs, optionally test accessibility first (only if not causing CORS issues)
    if (isS3Url(processedUrl)) {
      console.log('S3 URL detected, testing accessibility...');
      try {
        const accessible = await testVideoAccessibility(processedUrl);
        if (!accessible) {
          console.warn('S3 URL accessibility test suggests potential issues');
        }
      } catch (error) {
        console.log('S3 accessibility test skipped due to error:', error.message);
      }
    }
    
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
        initDirectPlayer(videoPlayer, processedUrl, videoType);      }
      
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
      console.log('Setting up direct player with URL:', videoUrl);
      console.log('Detected video type:', videoType);
      
      // Clear any existing content and reset video element
      videoElement.innerHTML = '';
      videoElement.removeAttribute('src');
      videoElement.load(); // Reset the video element state
      
      // Set CORS attributes for S3 compatibility
      videoElement.setAttribute('crossorigin', 'anonymous');
      videoElement.setAttribute('preload', 'metadata');
      
      // Additional attributes for better compatibility
      videoElement.setAttribute('controls', 'true');
      videoElement.setAttribute('playsinline', 'true'); // Important for mobile Safari
      
      // Try multiple approaches for S3 compatibility
      if (isS3Url(videoUrl)) {
        console.log('Detected S3 URL, using S3-optimized approach');
        setupS3Video(videoElement, videoUrl, videoType);
      } else {
        // Regular video setup
        setupRegularVideo(videoElement, videoUrl, videoType);
      }
        // Add comprehensive error handling
      videoElement.onerror = function(e) {
        console.error('Video error details:', {
          error: e,
          networkState: videoElement.networkState,
          readyState: videoElement.readyState,
          currentSrc: videoElement.currentSrc,
          videoType: videoType,
          errorCode: videoElement.error ? videoElement.error.code : 'unknown',
          errorMessage: videoElement.error ? videoElement.error.message : 'unknown'
        });
        
        logVideoElementState(videoElement, 'ERROR');
        
        // Try alternative approaches before falling back to iframe
        tryAlternativeFormats(videoElement, videoUrl);
      };
      
      videoElement.onloadedmetadata = function() {
        console.log('Video metadata loaded successfully');
        logVideoElementState(videoElement, 'METADATA_LOADED');
      };
      
      videoElement.oncanplay = function() {
        console.log('Video can start playing');
        logVideoElementState(videoElement, 'CAN_PLAY');
      };
      
      videoElement.onloadstart = function() {
        console.log('Video load started');
        logVideoElementState(videoElement, 'LOAD_START');
      };
      
      // Initialize Plyr player after a short delay to ensure video is ready
      setTimeout(() => {
        initPlyrPlayer(videoElement);
      }, 100);
      
    } catch (error) {
      console.error('Error setting up direct player:', error);
      const videoEmbed = document.getElementById('video-embed');
      fallbackToIframe(videoUrl, videoElement, videoEmbed);
    }
  }

  /**
   * Check if URL is from S3
   * @param {string} url - The video URL
   * @returns {boolean} - Whether this is an S3 URL
   */
  function isS3Url(url) {
    return url.includes('amazonaws.com') || 
           url.includes('s3.') || 
           url.includes('.s3.') ||
           url.includes('s3-');
  }
  /**
   * Setup video for S3 URLs with specific optimizations
   * @param {HTMLElement} videoElement - The video element
   * @param {string} videoUrl - The S3 video URL
   * @param {string} videoType - The MIME type
   */
  function setupS3Video(videoElement, videoUrl, videoType) {
    console.log('Setting up S3 video with detected type:', videoType);
    
    // For S3 URLs, try to detect the format from the URL more accurately
    const urlLower = videoUrl.toLowerCase();
    let detectedFormat = null;
    
    // More aggressive format detection for S3
    if (urlLower.includes('.mp4') || urlLower.includes('mp4')) {
      detectedFormat = 'video/mp4';
    } else if (urlLower.includes('.webm') || urlLower.includes('webm')) {
      detectedFormat = 'video/webm';
    } else if (urlLower.includes('.mov') || urlLower.includes('mov')) {
      detectedFormat = 'video/quicktime';
    } else if (urlLower.includes('.avi') || urlLower.includes('avi')) {
      detectedFormat = 'video/x-msvideo';
    }
    
    // Create comprehensive source list with codec specifications
    const sources = [];
    
    // MP4 with various codec specifications (most compatible)
    if (detectedFormat === 'video/mp4' || videoType === 'video/mp4' || !detectedFormat) {
      sources.push(
        { src: videoUrl, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' },
        { src: videoUrl, type: 'video/mp4; codecs="avc1.64001E, mp4a.40.2"' },
        { src: videoUrl, type: 'video/mp4; codecs="mp4v.20.8, mp4a.40.2"' },
        { src: videoUrl, type: 'video/mp4' }
      );
    }
    
    // WebM with codec specifications
    if (detectedFormat === 'video/webm' || videoType === 'video/webm') {
      sources.push(
        { src: videoUrl, type: 'video/webm; codecs="vp8, vorbis"' },
        { src: videoUrl, type: 'video/webm; codecs="vp9, vorbis"' },
        { src: videoUrl, type: 'video/webm; codecs="vp9, opus"' },
        { src: videoUrl, type: 'video/webm' }
      );
    }
    
    // QuickTime/MOV formats
    if (detectedFormat === 'video/quicktime' || videoType === 'video/quicktime') {
      sources.push(
        { src: videoUrl, type: 'video/quicktime' },
        { src: videoUrl, type: 'video/mp4' } // MOV often works as MP4
      );
    }
    
    // AVI formats
    if (detectedFormat === 'video/x-msvideo' || videoType === 'video/x-msvideo') {
      sources.push(
        { src: videoUrl, type: 'video/x-msvideo' },
        { src: videoUrl, type: 'video/avi' },
        { src: videoUrl, type: 'video/mp4' } // Sometimes AVI works as MP4
      );
    }
    
    // If no specific format detected, add common fallbacks
    if (!detectedFormat || detectedFormat === 'video/mp4') {
      sources.push(
        { src: videoUrl, type: 'video/mp4; codecs="avc1.42E01E"' },
        { src: videoUrl, type: 'video/mp4; codecs="mp4v.20.240"' }
      );
    }
    
    // Generic fallbacks (without codec specifications)
    const genericTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/*', ''];
    genericTypes.forEach(type => {
      if (!sources.some(s => s.type === type)) {
        sources.push({ src: videoUrl, type });
      }
    });
    
    // Remove duplicate sources
    const uniqueSources = sources.filter((source, index, self) => 
      index === self.findIndex(s => s.type === source.type)
    );
    
    // Create source elements
    uniqueSources.forEach((source, index) => {
      const sourceElement = document.createElement('source');
      sourceElement.src = source.src;
      if (source.type) {
        sourceElement.type = source.type;
      }
      
      // Add error handling for each source
      sourceElement.onerror = function(e) {
        console.warn(`Source ${index + 1} failed (${source.type || 'no type'}):`, e);
      };
      
      videoElement.appendChild(sourceElement);
    });
    
    console.log('Created S3 video sources:', uniqueSources);
    
    // Set the src attribute directly as primary fallback (most important)
    videoElement.src = videoUrl;
  }

  /**
   * Setup regular video (non-S3)
   * @param {HTMLElement} videoElement - The video element
   * @param {string} videoUrl - The video URL
   * @param {string} videoType - The MIME type
   */
  function setupRegularVideo(videoElement, videoUrl, videoType) {
    // Create multiple sources with codec specifications for better compatibility
    const sources = [];
    
    // Add primary type with codec specifications
    if (videoType === 'video/mp4') {
      sources.push(
        { src: videoUrl, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' },
        { src: videoUrl, type: 'video/mp4; codecs="avc1.64001E, mp4a.40.2"' },
        { src: videoUrl, type: 'video/mp4' }
      );
    } else if (videoType === 'video/webm') {
      sources.push(
        { src: videoUrl, type: 'video/webm; codecs="vp8, vorbis"' },
        { src: videoUrl, type: 'video/webm; codecs="vp9, vorbis"' },
        { src: videoUrl, type: 'video/webm' }
      );
    } else {
      sources.push({ src: videoUrl, type: videoType });
    }
    
    // Add generic fallbacks
    sources.push(
      { src: videoUrl, type: 'video/mp4' },
      { src: videoUrl, type: 'video/*' },
      { src: videoUrl, type: '' }
    );
    
    // Remove duplicates
    const uniqueSources = sources.filter((source, index, self) => 
      index === self.findIndex(s => s.type === source.type)
    );
    
    // Create source elements
    uniqueSources.forEach((source, index) => {
      const sourceElement = document.createElement('source');
      sourceElement.src = source.src;
      if (source.type) {
        sourceElement.type = source.type;
      }
      
      sourceElement.onerror = function(e) {
        console.warn(`Regular video source ${index + 1} failed (${source.type || 'no type'}):`, e);
      };
      
      videoElement.appendChild(sourceElement);
    });
    
    // Set src attribute as primary fallback
    videoElement.src = videoUrl;
  }
  /**
   * Try alternative video formats/approaches before giving up
   * @param {HTMLElement} videoElement - The video element
   * @param {string} videoUrl - The video URL
   */
  function tryAlternativeFormats(videoElement, videoUrl) {
    console.log('Trying alternative formats for:', videoUrl);
    
    // Clear existing sources and reset video element
    videoElement.innerHTML = '';
    videoElement.removeAttribute('src');
    
    // Comprehensive alternative format list
    const alternativeTypes = [];
    
    // For S3 URLs, be more aggressive with format detection
    if (isS3Url(videoUrl)) {
      console.log('S3 URL detected, trying comprehensive format detection');
      
      const urlLower = videoUrl.toLowerCase();
      
      // MP4 variants (most common)
      if (urlLower.includes('mp4') || urlLower.includes('.mp4') || !urlLower.match(/\.(webm|mov|avi|mkv|flv)(\?|$)/)) {
        alternativeTypes.push(
          'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
          'video/mp4; codecs="avc1.64001E, mp4a.40.2"',
          'video/mp4; codecs="avc1.4D401E, mp4a.40.2"',
          'video/mp4; codecs="mp4v.20.8, mp4a.40.2"',
          'video/mp4; codecs="avc1.42E01E"',
          'video/mp4'
        );
      }
      
      // WebM variants
      if (urlLower.includes('webm') || urlLower.includes('.webm')) {
        alternativeTypes.push(
          'video/webm; codecs="vp8, vorbis"',
          'video/webm; codecs="vp9, vorbis"',
          'video/webm; codecs="vp9, opus"',
          'video/webm; codecs="vp8"',
          'video/webm'
        );
      }
      
      // MOV/QuickTime variants
      if (urlLower.includes('mov') || urlLower.includes('.mov')) {
        alternativeTypes.push(
          'video/quicktime',
          'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', // MOV often works as MP4
          'video/mp4'
        );
      }
      
      // AVI variants
      if (urlLower.includes('avi') || urlLower.includes('.avi')) {
        alternativeTypes.push(
          'video/x-msvideo',
          'video/avi',
          'video/mp4' // Sometimes AVI codecs work with MP4 container
        );
      }
      
      // If no specific format detected from URL, try all common formats
      if (alternativeTypes.length === 0) {
        alternativeTypes.push(
          'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
          'video/mp4; codecs="avc1.64001E, mp4a.40.2"',
          'video/mp4',
          'video/webm; codecs="vp8, vorbis"',
          'video/webm',
          'video/quicktime',
          'video/x-msvideo'
        );
      }
    } else {
      // For non-S3 URLs, try common formats
      alternativeTypes.push(
        'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/mp4; codecs="avc1.64001E, mp4a.40.2"',
        'video/mp4',
        'video/webm; codecs="vp8, vorbis"',
        'video/webm'
      );
    }
    
    // Add universal fallbacks
    alternativeTypes.push(
      'application/octet-stream', // Sometimes servers send video with this MIME type
      'video/*',
      '' // No MIME type - let browser decide
    );
    
    // Remove duplicates while preserving order
    const uniqueTypes = [...new Set(alternativeTypes)];
    
    // Create source elements for each alternative type
    uniqueTypes.forEach((type, index) => {
      const sourceElement = document.createElement('source');
      sourceElement.src = videoUrl;
      if (type) {
        sourceElement.type = type;
      }
      
      sourceElement.onerror = function(e) {
        console.warn(`Alternative source ${index + 1} failed (${type || 'no type'}):`, e);
      };
      
      videoElement.appendChild(sourceElement);
    });
    
    console.log('Created alternative sources:', uniqueTypes);
    
    // Set up one more error handler for final fallback
    let finalErrorHandled = false;
    videoElement.onerror = function(e) {
      if (!finalErrorHandled) {
        finalErrorHandled = true;
        console.log('All alternative video formats failed, falling back to iframe');
        const videoEmbed = document.getElementById('video-embed');
        fallbackToIframe(videoUrl, videoElement, videoEmbed);
      }
    };
    
    // Set src directly as the primary method (this is often what works)
    videoElement.src = videoUrl;
    
    // Force reload to try the new sources
    try {
      videoElement.load();
    } catch (error) {
      console.warn('Error calling video.load():', error);
    }
    
    console.log('Alternative formats setup complete, trying to load video');
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
      // Wait for video to be ready before initializing Plyr
      const initPlyr = () => {
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
          settings: ['speed'], // Remove quality for now as it may cause issues with S3
          speed: {
            selected: 1,
            options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
          },
          ratio: '16:9',
          loadSprite: true,
          iconUrl: 'https://cdn.plyr.io/3.7.8/plyr.svg',
          blankVideo: 'https://cdn.plyr.io/static/blank.mp4',
          crossorigin: true,
          preload: 'metadata',
          // S3-specific optimizations
          seekTime: 10,
          volume: 1,
          clickToPlay: true,
          disableContextMenu: false,
          resetOnEnd: false,
          autopause: true,
          captions: { active: false, language: 'auto', update: false }
        };
        
        currentPlayer = new Plyr(videoElement, plyrConfig);
        
        // Add event listeners with more detailed logging
        currentPlayer.on('ready', () => {
          console.log('Plyr player ready');
          console.log('Player source:', currentPlayer.source);
        });
        
        currentPlayer.on('error', (event) => {
          console.error('Plyr error event:', event);
          console.error('Player state:', {
            source: currentPlayer.source,
            currentTime: currentPlayer.currentTime,
            duration: currentPlayer.duration,
            paused: currentPlayer.paused
          });
        });
        
        currentPlayer.on('loadstart', () => {
          console.log('Plyr: Video loading started');
        });
        
        currentPlayer.on('canplay', () => {
          console.log('Plyr: Video can start playing');
        });
        
        currentPlayer.on('loadeddata', () => {
          console.log('Plyr: Video data loaded');
        });
        
        currentPlayer.on('loadedmetadata', () => {
          console.log('Plyr: Video metadata loaded');
        });
        
        currentPlayer.on('progress', () => {
          console.log('Plyr: Video loading progress');
        });
        
        // Handle media errors specifically
        videoElement.addEventListener('error', (e) => {
          console.error('Native video element error:', e);
          console.error('Video element error code:', videoElement.error?.code);
          console.error('Video element error message:', videoElement.error?.message);
          
          // Don't fallback immediately, let Plyr try to handle it
          setTimeout(() => {
            if (videoElement.error) {
              console.log('Video still has errors after timeout, falling back to iframe');
              const videoEmbed = document.getElementById('video-embed');
              fallbackToIframe(videoElement.src || videoElement.currentSrc, videoElement, videoEmbed);
            }
          }, 3000);
        });
      };
      
      // Check if video element is ready
      if (videoElement.readyState >= 1 || videoElement.src) {
        initPlyr();
      } else {
        // Wait for loadstart event
        const loadStartHandler = () => {
          videoElement.removeEventListener('loadstart', loadStartHandler);
          setTimeout(initPlyr, 200);
        };
        videoElement.addEventListener('loadstart', loadStartHandler);
        
        // Fallback timeout
        setTimeout(() => {
          videoElement.removeEventListener('loadstart', loadStartHandler);
          initPlyr();
        }, 2000);
      }
      
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