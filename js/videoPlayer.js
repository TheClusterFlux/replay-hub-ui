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
   * Log video element state for debugging (simplified)
   * @param {HTMLElement} videoElement - The video element
   * @param {string} context - Context label for the log
   */
  function logVideoElementState(videoElement, context = 'DEBUG') {
    // Only log errors - skip success messages to reduce console noise
    if (context === 'ERROR' || context.includes('FAILED') || videoElement.error) {
      const errorCodes = {
        1: 'MEDIA_ERR_ABORTED - The video download was aborted',
        2: 'MEDIA_ERR_NETWORK - A network error occurred', 
        3: 'MEDIA_ERR_DECODE - The video is corrupted or not supported',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - No video with supported format and MIME type found'
      };
      
      console.group(`🚫 Video Error [${context}]`);
      console.error('Current Source:', videoElement.currentSrc || videoElement.src);
      console.error('Duration:', videoElement.duration);
      console.error('Dimensions:', `${videoElement.videoWidth}x${videoElement.videoHeight}`);
      
      if (videoElement.error) {
        console.error('Error Code:', `${errorCodes[videoElement.error.code]} (${videoElement.error.code})`);
        console.error('Error Message:', videoElement.error.message);
      }
      console.groupEnd();
    }
    // Skip all success logging to reduce console noise
  }
  /**
   * Test video URL accessibility before attempting to play
   * @param {string} videoUrl - The video URL to test
   * @returns {Promise<{accessible: boolean, corsError: boolean, suggestedFix: string, contentTypeIssue?: boolean, networkError?: boolean}>} - Accessibility results
   */
  async function testVideoAccessibility(videoUrl) {
    try {
      const response = await fetch(videoUrl, {
        method: 'HEAD',
        mode: 'cors',
        headers: {
          'Range': 'bytes=0-1024' // Request only first 1KB to test accessibility
        }
      });
      
      // Check if S3 returned a proper Content-Type
      const contentType = response.headers.get('content-type');
      if (isS3Url(videoUrl)) {
        
        if (!contentType) {
          console.error('❌ No Content-Type header found on S3 object');
          return { 
            accessible: response.ok, 
            corsError: false, 
            suggestedFix: 'S3 object missing Content-Type header - needs to be set to video/mp4',
            contentTypeIssue: true
          };
        } else if (!contentType.startsWith('video/') && !contentType.includes('octet-stream')) {
          console.warn('⚠️ S3 file has incorrect Content-Type header:', contentType);
          return { 
            accessible: response.ok, 
            corsError: false, 
            suggestedFix: `S3 object has wrong Content-Type: "${contentType}" - should be video/mp4`,
            contentTypeIssue: true
          };
        } else if (contentType.includes('octet-stream')) {
          console.warn('⚠️ S3 file has generic Content-Type (octet-stream)');
          return { 
            accessible: response.ok, 
            corsError: false, 
            suggestedFix: 'S3 object has generic Content-Type - should be set to video/mp4 for better compatibility',
            contentTypeIssue: true
          };
        }
      }
      
      return { accessible: response.ok, corsError: false, suggestedFix: '', contentTypeIssue: false };
    } catch (error) {
      console.warn('Video URL accessibility test failed:', error);
      
      // Check for CORS-specific errors
      if (error.message && (error.message.includes('CORS') || error.message.includes('cross-origin'))) {
        console.error('🚫 CORS Error Detected! S3 bucket needs CORS configuration');
        return { 
          accessible: false, 
          corsError: true, 
          suggestedFix: 'S3 bucket needs CORS policy allowing your domain'
        };
      }
      
      // Check for network errors (file not found, connectivity issues)
      if (error.message && (error.message.includes('NetworkError') || error.message.includes('Failed to fetch'))) {
        console.error('🌐 Network Error: Cannot reach the video URL');
        return {
          accessible: false,
          corsError: false,
          suggestedFix: 'Video file may not exist at this URL or there are network connectivity issues',
          contentTypeIssue: false,
          networkError: true
        };
      }
      
      // For other errors, don't fail completely
      return { accessible: true, corsError: false, suggestedFix: '', contentTypeIssue: false };
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
    
    // Enhanced URL validation
    const urlValidation = validateVideoUrl(videoUrl);
    if (!urlValidation.isValid) {
      console.error('❌ URL Validation Failed:', urlValidation.error);
      showError(`Invalid video URL: ${urlValidation.error}`);
      return;
    }
    
    // Clean up any existing player
    cleanupPlayer();
    
    // Ensure video URL is properly encoded but preserve S3 signatures
    let processedUrl = videoUrl.trim();    
    
    // For S3 URLs, test accessibility and handle CORS issues
    if (isS3Url(processedUrl)) {
      try {
        const accessResult = await testVideoAccessibility(processedUrl);
        if (accessResult.corsError) {
          console.error('🚫 CORS Error: Cannot access S3 video due to CORS policy');
          console.error('💡 Solution:', accessResult.suggestedFix);
          
          // Try alternative approaches for CORS-blocked S3 videos
          return initS3VideoWithCorsWorkaround(processedUrl, videoPlayer, videoEmbed);
        } else if (accessResult.networkError) {
          console.error('🌐 Network Error:', accessResult.suggestedFix);
          
          // Try alternative approaches for network errors
          return initVideoWithNetworkErrorHandling(processedUrl, videoPlayer, videoEmbed, accessResult.suggestedFix);
        } else if (accessResult.contentTypeIssue) {
          console.error('📝 Content-Type Issue:', accessResult.suggestedFix);
          
          // Try to force video playback despite Content-Type issues
          return initS3VideoWithContentTypeWorkaround(processedUrl, videoPlayer, videoEmbed, accessResult.suggestedFix);
        } else if (!accessResult.accessible) {
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
      // Clear any existing content and reset video element
      videoElement.innerHTML = '';
      videoElement.removeAttribute('src');
      videoElement.load(); // Reset the video element state
      
      // Set attributes for video compatibility
      videoElement.setAttribute('preload', 'metadata');
      videoElement.setAttribute('controls', 'true');
      videoElement.setAttribute('playsinline', 'true'); // Important for mobile Safari
      
      // Only set CORS for non-S3 URLs or when we're sure CORS is configured
      // S3 URLs will be handled with a different approach if CORS fails
      if (!isS3Url(videoUrl)) {
        videoElement.setAttribute('crossorigin', 'anonymous');
      }
      
      // Try multiple approaches for S3 compatibility
      if (isS3Url(videoUrl)) {
        setupS3Video(videoElement, videoUrl, videoType);
      } else {
        // Regular video setup
        setupRegularVideo(videoElement, videoUrl, videoType);
      }
        // Add comprehensive error handling
      videoElement.onerror = function(e) {
        console.error('🚫 Video Error Occurred');
        
              // Check for specific decode errors  
      if (videoElement.error && videoElement.error.code === 3) {
        console.error('❌ DECODE ERROR: Video file is corrupted or unsupported format');
        
        // Analyze the video file headers before showing error
        analyzeVideoFile(videoUrl).then(() => {
          const videoPlayer = document.getElementById('video-player');
          const videoEmbed = document.getElementById('video-embed');
          showCorruptedVideoError(videoUrl, videoPlayer, videoEmbed);
        });
        return; // Don't try alternatives for corrupted videos
      }
      
      // Check for MIME type not supported errors
      if (videoElement.error && videoElement.error.code === 4) {
        console.error('❌ MIME TYPE ERROR: No supported format found');
        
        // Try one more approach with minimal MIME types
        tryMinimalVideoSetup(videoUrl, videoElement);
        return;
      }
        
        logVideoElementState(videoElement, 'ERROR');
        
        // Try alternative approaches for other errors
        tryAlternativeFormats(videoElement, videoUrl);
      };
      
      videoElement.onloadedmetadata = function() {
        // Video loaded successfully - no need to log this
        logVideoElementState(videoElement, 'METADATA_LOADED_SUCCESS');
      };
      
      videoElement.oncanplay = function() {
        // Video ready to play - no need to log this  
        logVideoElementState(videoElement, 'CAN_PLAY_SUCCESS');
      };
      
      videoElement.onloadstart = function() {
        // Reduce noise - only log if there are issues
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
   * Validate video URL for common issues
   * @param {string} url - The video URL to validate
   * @returns {{isValid: boolean, error?: string}} - Validation result
   */
  function validateVideoUrl(url) {
    try {
      // Test if it's a valid URL
      const urlObj = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, error: 'URL must use http or https protocol' };
      }
      
      // Check if hostname exists
      if (!urlObj.hostname) {
        return { isValid: false, error: 'URL must have a valid hostname' };
      }
      
      // For S3 URLs, do additional validation
      if (isS3Url(url)) {
        // Check if it looks like a valid S3 URL structure
        if (!urlObj.pathname || urlObj.pathname === '/') {
          return { isValid: false, error: 'S3 URL must include object key (filename)' };
        }
        
        // Check for common S3 URL patterns
        const s3Patterns = [
          /^https:\/\/[\w-]+\.s3\.[\w-]+\.amazonaws\.com\/.+/,
          /^https:\/\/s3\.[\w-]+\.amazonaws\.com\/[\w-]+\/.+/,
          /^https:\/\/[\w-]+\.s3\.amazonaws\.com\/.+/
        ];
        
        const isValidS3Pattern = s3Patterns.some(pattern => pattern.test(url));
        if (!isValidS3Pattern) {
          console.warn('⚠️ S3 URL format may be non-standard, but attempting to load anyway');
        }
      }
      
      // Check if URL ends with a likely video extension
      const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.m3u8', '.mpd'];
      const hasVideoExtension = videoExtensions.some(ext => 
        urlObj.pathname.toLowerCase().includes(ext)
      );
      
      if (!hasVideoExtension) {
        console.warn('⚠️ URL does not appear to end with a video file extension');
        // Don't fail validation, just warn
      }
      
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `Invalid URL format: ${error.message}` };
    }
  }
  
  /**
   * Handle S3 videos with CORS issues using alternative approaches
   * @param {string} videoUrl - The S3 video URL
   * @param {HTMLElement} videoPlayer - The video player element
   * @param {HTMLElement} videoEmbed - The iframe element
   */
  function initS3VideoWithCorsWorkaround(videoUrl, videoPlayer, videoEmbed) {
    console.log('🔧 Attempting CORS workaround for S3 video...');
    
    // Show error message with solution
    const errorMessage = `
      <div class="cors-error-message" style="
        background: #ffe6e6;
        border: 2px solid #ff4444;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        text-align: center;
      ">
        <h3 style="color: #cc0000; margin-top: 0;">🚫 CORS Error</h3>
        <p><strong>Cannot load video due to Cross-Origin Resource Sharing (CORS) policy.</strong></p>
        <p>The S3 bucket needs to be configured to allow access from this domain.</p>
        <details style="margin-top: 15px; text-align: left;">
          <summary style="cursor: pointer; font-weight: bold;">🔧 How to fix this (for developers)</summary>
          <div style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <p><strong>Add this CORS policy to your S3 bucket:</strong></p>
            <pre style="background: #333; color: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["${window.location.origin}", "*"],
    "ExposeHeaders": ["Content-Length", "Content-Type"]
  }
]</pre>
            <p><strong>Or set individual object permissions to public read.</strong></p>
          </div>
        </details>
        <button onclick="window.location.reload()" style="
          background: #007cba;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 15px;
        ">Retry</button>
      </div>
    `;
    
    // Try different approaches
    console.log('Trying alternative approaches...');
    
    // Method 1: Try without CORS mode (no-cors)
    initS3VideoNoCors(videoUrl, videoPlayer, videoEmbed, errorMessage);
  }
  
  /**
   * Try to load S3 video without CORS mode
   * @param {string} videoUrl - The S3 video URL
   * @param {HTMLElement} videoPlayer - The video player element
   * @param {HTMLElement} videoEmbed - The iframe element
   * @param {string} errorMessage - Error message to display if all methods fail
   */
  function initS3VideoNoCors(videoUrl, videoPlayer, videoEmbed, errorMessage) {
    console.log('🔄 Trying no-cors approach...');
    
    // Clear and setup video element
    videoPlayer.innerHTML = '';
    videoPlayer.style.display = 'block';
    videoEmbed.style.display = 'none';
    
    // Create video element without crossorigin attribute
    const videoElement = document.createElement('video');
    videoElement.id = 'video-player';
    videoElement.className = 'custom-video-player';
    videoElement.setAttribute('controls', 'true');
    videoElement.setAttribute('preload', 'metadata');
    videoElement.setAttribute('playsinline', 'true');
    // Note: NOT setting crossorigin attribute to avoid CORS preflight
    
    // Add multiple source attempts
    const sources = [
      { src: videoUrl, type: 'video/mp4' },
      { src: videoUrl, type: 'video/*' },
      { src: videoUrl, type: '' }
    ];
    
    sources.forEach((source, index) => {
      const sourceElement = document.createElement('source');
      sourceElement.src = source.src;
      if (source.type) {
        sourceElement.type = source.type;
      }
      
      sourceElement.onerror = function(e) {
        console.warn(`No-CORS source ${index + 1} failed (${source.type || 'no type'})`);
      };
      
      videoElement.appendChild(sourceElement);
    });
    
    // Set direct src as fallback
    videoElement.src = videoUrl;
    
    // Add event handlers
    videoElement.onloadedmetadata = function() {
      console.log('✅ No-CORS approach successful!');
      logVideoElementState(videoElement, 'NO_CORS_SUCCESS');
      
      // Try to initialize Plyr if available
      if (window.Plyr) {
        try {
          currentPlayer = new Plyr(videoElement, {
            controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
            crossorigin: false // Important: disable crossorigin in Plyr
          });
          console.log('Plyr initialized for no-CORS video');
        } catch (e) {
          console.warn('Plyr initialization failed for no-CORS video:', e);
        }
      }
    };
    
    videoElement.onerror = function(e) {
      console.error('❌ No-CORS approach also failed');
      logVideoElementState(videoElement, 'NO_CORS_FAILED');
      
      // Show error message as last resort
      videoPlayer.innerHTML = errorMessage;
      videoPlayer.style.display = 'block';
      videoEmbed.style.display = 'none';
    };
    
    // Add video element to player
    videoPlayer.appendChild(videoElement);
    
    // Try to load
    try {
      videoElement.load();
    } catch (error) {
      console.error('Error loading no-CORS video:', error);
      videoPlayer.innerHTML = errorMessage;
    }
  }
  
  /**
   * Analyze video file headers to get detailed information
   * @param {string} videoUrl - The video URL to analyze
   * @returns {Promise} - Analysis results
   */
  async function analyzeVideoFile(videoUrl) {
    console.log('🔍 Analyzing video file headers...');
    
    try {
      // Get the first few bytes of the file to analyze format
      const response = await fetch(videoUrl, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-100' // Get first 100 bytes
        }
      });
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        
        // Check file signature
        const signature = Array.from(bytes.slice(0, 20))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
        
        console.log('📄 File signature (first 20 bytes):', signature);
        
        // Check for common video file signatures
        const videoSignatures = {
          mp4: ['00 00 00', 'ftyp'],
          mov: ['00 00 00', 'ftyp', 'qt'],
          avi: ['52 49 46 46'], // RIFF
          webm: ['1a 45 df a3'], // EBML
          flv: ['46 4c 56'], // FLV
        };
        
        let detectedFormat = 'unknown';
        const hexString = signature.toLowerCase();
        
        if (hexString.includes('66 74 79 70')) {
          detectedFormat = 'MP4/MOV container';
        } else if (hexString.startsWith('52 49 46 46')) {
          detectedFormat = 'AVI container';
        } else if (hexString.startsWith('1a 45 df a3')) {
          detectedFormat = 'WebM container';
        } else if (hexString.startsWith('46 4c 56')) {
          detectedFormat = 'FLV container';
        }
        
        console.log('🎬 Detected format from signature:', detectedFormat);
        console.log('📊 File size from response:', response.headers.get('content-range'));
        
        // Additional analysis
        if (detectedFormat === 'unknown') {
          console.error('⚠️ Unrecognized file format - file may be corrupted or not a video');
        }
        
      } else {
        console.error('❌ Could not analyze file headers:', response.status);
      }
    } catch (error) {
      console.error('❌ Error analyzing video file:', error);
    }
  }
  
  /**
   * Try minimal video setup without any MIME type specifications
   * @param {string} videoUrl - The video URL
   * @param {HTMLElement} videoElement - The video element
   */
  function tryMinimalVideoSetup(videoUrl, videoElement) {
    console.log('🔄 Trying minimal video setup...');
    
    // Clear everything and start fresh
    videoElement.innerHTML = '';
    videoElement.removeAttribute('src');
    videoElement.removeAttribute('type');
    
    // Set src directly without any MIME type hints
    videoElement.src = videoUrl;
    
    let hasLoaded = false;
    
    videoElement.onloadedmetadata = function() {
      hasLoaded = true;
      console.log('✅ Minimal setup worked!');
      logVideoElementState(videoElement, 'MINIMAL_SETUP_SUCCESS');
    };
    
    videoElement.onerror = function(e) {
      if (!hasLoaded) {
        console.error('❌ Minimal setup also failed');
        console.error('🔍 This confirms the video file itself is the problem');
        
        // Show the corrupted video error
        const videoPlayer = document.getElementById('video-player');
        const videoEmbed = document.getElementById('video-embed');
        showCorruptedVideoError(videoUrl, videoPlayer, videoEmbed);
      }
    };
    
    // Try to load
    try {
      videoElement.load();
    } catch (error) {
      console.error('❌ Error in minimal setup:', error);
    }
    
    // Timeout if nothing happens
    setTimeout(() => {
      if (!hasLoaded && videoElement.readyState === 0) {
        console.error('⏰ Minimal setup timeout - video definitely corrupted');
        const videoPlayer = document.getElementById('video-player');
        const videoEmbed = document.getElementById('video-embed');
        showCorruptedVideoError(videoUrl, videoPlayer, videoEmbed);
      }
    }, 5000);
  }
  
  /**
   * Show error message for corrupted/unsupported video files
   * @param {string} videoUrl - The video URL
   * @param {HTMLElement} videoPlayer - The video player element
   * @param {HTMLElement} videoEmbed - The iframe element
   */
  function showCorruptedVideoError(videoUrl, videoPlayer, videoEmbed) {
    console.log('🚫 Showing corrupted video error message');
    
    const filename = videoUrl.split('/').pop().split('?')[0];
    
    const errorMessage = `
      <div class="corrupted-video-error" style="
        background: #ffe6e6;
        border: 2px solid #ff4444;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        text-align: center;
      ">
        <h3 style="color: #cc0000; margin-top: 0;">📹 Video Cannot Be Played</h3>
        <p><strong>The video file is corrupted or in an unsupported format.</strong></p>
        <p>File: <code>${filename}</code></p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0; text-align: left;">
          <h4>🔍 What This Means:</h4>
          <ul>
            <li><strong>File Corruption:</strong> The video file may have been damaged during upload or storage</li>
            <li><strong>Unsupported Format:</strong> The video might be encoded with unsupported codecs</li>
            <li><strong>Incomplete Upload:</strong> The file transfer may not have completed properly</li>
            <li><strong>Wrong File Type:</strong> The file might not actually be a video</li>
          </ul>
        </div>
        
        <details style="margin-top: 15px; text-align: left;">
          <summary style="cursor: pointer; font-weight: bold;">🔧 How to Fix This</summary>
          <div style="margin-top: 10px; padding: 10px; background: #f0f0f0; border-radius: 4px;">
            <h5>For Developers:</h5>
            <ol>
              <li><strong>Check the original file:</strong> Verify the source video works locally</li>
              <li><strong>Re-upload the video:</strong> Delete and upload the file again</li>
              <li><strong>Convert the video:</strong> Use ffmpeg to convert to a standard format:
                <pre style="background: #333; color: #fff; padding: 8px; border-radius: 4px; font-size: 12px; margin: 5px 0;">ffmpeg -i input.mov -c:v libx264 -c:a aac -preset medium output.mp4</pre>
              </li>
              <li><strong>Check file integrity:</strong> Verify the S3 object wasn't corrupted during upload</li>
            </ol>
            
            <h5>Supported Formats:</h5>
            <p>✅ MP4 (H.264 + AAC)<br/>
               ✅ WebM (VP8/VP9 + Vorbis/Opus)<br/>
               ❌ Avoid: MOV, AVI, FLV, WMV without conversion</p>
          </div>
        </details>
        
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
          <button onclick="window.open('${videoUrl}', '_blank')" style="
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
          ">Download File</button>
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
    
    // Show error message
    cleanupPlayer();
    videoPlayer.innerHTML = errorMessage;
    videoPlayer.style.display = 'block';
    videoEmbed.style.display = 'none';
  }
  
  /**
   * Handle videos with network errors (404, connectivity issues, etc.)
   * @param {string} videoUrl - The video URL
   * @param {HTMLElement} videoPlayer - The video player element
   * @param {HTMLElement} videoEmbed - The iframe element
   * @param {string} issue - Description of the network issue
   */
  function initVideoWithNetworkErrorHandling(videoUrl, videoPlayer, videoEmbed, issue) {
    console.log('🔧 Attempting network error workaround...');
    
    // Show detailed error message with troubleshooting steps
    const errorMessage = `
      <div class="network-error-message" style="
        background: #ffe6e6;
        border: 2px solid #ff4444;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        text-align: center;
      ">
        <h3 style="color: #cc0000; margin-top: 0;">🌐 Network Error</h3>
        <p><strong>${issue}</strong></p>
        <p>Cannot reach the video at this URL.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 15px 0; text-align: left;">
          <h4>📋 Troubleshooting Steps:</h4>
          <ol>
            <li><strong>Check the URL:</strong><br/>
                <code style="background: #eee; padding: 2px 4px; border-radius: 2px; word-break: break-all;">${videoUrl}</code></li>
            <li><strong>Verify the file exists in S3:</strong><br/>
                Go to AWS S3 Console and check if the file exists at this location</li>
            <li><strong>Check S3 bucket permissions:</strong><br/>
                The object might not be publicly readable</li>
            <li><strong>Verify your internet connection</strong></li>
            <li><strong>Check if the S3 URL has expired</strong> (if using presigned URLs)</li>
          </ol>
        </div>
        
        <details style="margin-top: 15px; text-align: left;">
          <summary style="cursor: pointer; font-weight: bold;">🔧 For Developers</summary>
          <div style="margin-top: 10px; padding: 10px; background: #f0f0f0; border-radius: 4px;">
            <p><strong>Make S3 object public:</strong></p>
            <pre style="background: #333; color: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">aws s3api put-object-acl --bucket your-bucket --key ${videoUrl.split('/').pop()} --acl public-read</pre>
            <p><strong>Or check if object exists:</strong></p>
            <pre style="background: #333; color: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">aws s3 ls s3://your-bucket/${videoUrl.split('/').pop()}</pre>
          </div>
        </details>
        
        <div style="margin-top: 15px;">
          <button onclick="window.location.reload()" style="
            background: #007cba;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
          ">Retry</button>
          <button onclick="testVideoUrlInNewTab('${videoUrl}')" style="
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
          ">Test URL in New Tab</button>
        </div>
      </div>
      
      <script>
        function testVideoUrlInNewTab(url) {
          window.open(url, '_blank');
        }
      </script>
    `;
    
    // Try some last-ditch efforts to load the video
    console.log('🔄 Trying direct video loading despite network errors...');
    
    // Clear and setup video element
    videoPlayer.innerHTML = '';
    videoPlayer.style.display = 'block';
    videoEmbed.style.display = 'none';
    
    // Create video element with minimal configuration
    const videoElement = document.createElement('video');
    videoElement.id = 'video-player';
    videoElement.className = 'custom-video-player';
    videoElement.setAttribute('controls', 'true');
    videoElement.setAttribute('preload', 'none'); // Don't preload if there are network issues
    videoElement.setAttribute('playsinline', 'true');
    
    // Try direct src assignment (sometimes works when fetch() fails)
    videoElement.src = videoUrl;
    
    let hasTriedLoading = false;
    
    // Add event handlers
    videoElement.onloadedmetadata = function() {
      console.log('✅ Direct loading worked despite network error!');
      logVideoElementState(videoElement, 'NETWORK_ERROR_RECOVERY_SUCCESS');
      
      // Try to initialize Plyr
      if (window.Plyr) {
        try {
          currentPlayer = new Plyr(videoElement, {
            controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
            crossorigin: false
          });
          console.log('Plyr initialized despite network error');
        } catch (e) {
          console.warn('Plyr initialization failed:', e);
        }
      }
    };
    
    videoElement.onerror = function(e) {
      console.error('❌ Direct loading also failed');
      logVideoElementState(videoElement, 'NETWORK_ERROR_RECOVERY_FAILED');
      
      if (!hasTriedLoading) {
        hasTriedLoading = true;
        console.log('🔄 Trying to load video anyway...');
        try {
          videoElement.load();
        } catch (loadError) {
          console.error('Load attempt failed:', loadError);
          // Show error message
          videoPlayer.innerHTML = errorMessage;
        }
      } else {
        // Show error message as final fallback
        videoPlayer.innerHTML = errorMessage;
      }
    };
    
    videoElement.oncanplay = function() {
      console.log('✅ Video recovered and can play!');
    };
    
    // Add video element to player
    videoPlayer.appendChild(videoElement);
    
    // Set a timeout to show error message if video doesn't load
    setTimeout(() => {
      if (videoElement.readyState === 0) {
        console.error('⏰ Video loading timeout - showing error message');
        videoPlayer.innerHTML = errorMessage;
      }
    }, 10000); // 10 second timeout
  }
  
  /**
   * Handle S3 videos with incorrect Content-Type headers
   * @param {string} videoUrl - The S3 video URL
   * @param {HTMLElement} videoPlayer - The video player element
   * @param {HTMLElement} videoEmbed - The iframe element
   * @param {string} issue - Description of the Content-Type issue
   */
  function initS3VideoWithContentTypeWorkaround(videoUrl, videoPlayer, videoEmbed, issue) {
    console.log('🔧 Attempting Content-Type workaround for S3 video...');
    
    // Show error message with solution
    const errorMessage = `
      <div class="content-type-error-message" style="
        background: #fff4e0;
        border: 2px solid #ffa500;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        text-align: center;
      ">
        <h3 style="color: #cc7a00; margin-top: 0;">📝 Content-Type Issue</h3>
        <p><strong>${issue}</strong></p>
        <p>The video file doesn't have the correct Content-Type header set in S3.</p>
        <details style="margin-top: 15px; text-align: left;">
          <summary style="cursor: pointer; font-weight: bold;">🔧 How to fix this (for developers)</summary>
          <div style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <p><strong>Option 1: Fix via AWS Console</strong></p>
            <ol style="text-align: left;">
              <li>Go to AWS S3 Console</li>
              <li>Find your video file: <code>${videoUrl.split('/').pop()}</code></li>
              <li>Select the file → Actions → Edit metadata</li>
              <li>Add: <code>Content-Type: video/mp4</code></li>
              <li>Save changes</li>
            </ol>
            <p><strong>Option 2: Fix via AWS CLI</strong></p>
            <pre style="background: #333; color: #fff; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">aws s3 cp s3://your-bucket/${videoUrl.split('/').pop()} s3://your-bucket/${videoUrl.split('/').pop()} \\
  --metadata-directive REPLACE \\
  --content-type video/mp4</pre>
            <p><strong>Option 3: Set Content-Type during upload</strong></p>
            <p>Always specify <code>--content-type video/mp4</code> when uploading videos to S3.</p>
          </div>
        </details>
        <button onclick="window.location.reload()" style="
          background: #007cba;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 15px;
        ">Retry</button>
      </div>
    `;
    
    // Try to force video playback despite Content-Type issues
    console.log('🔄 Trying to force video playback with explicit MIME types...');
    
    // Clear and setup video element
    videoPlayer.innerHTML = '';
    videoPlayer.style.display = 'block';
    videoEmbed.style.display = 'none';
    
    // Create video element
    const videoElement = document.createElement('video');
    videoElement.id = 'video-player';
    videoElement.className = 'custom-video-player';
    videoElement.setAttribute('controls', 'true');
    videoElement.setAttribute('preload', 'metadata');
    videoElement.setAttribute('playsinline', 'true');
    
    // For Content-Type issues, try aggressive MIME type forcing
    // We'll create sources that explicitly tell the browser what to expect
    const aggressiveSources = [
      // Most common MP4 codec combinations
      { src: videoUrl, type: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"' },
      { src: videoUrl, type: 'video/mp4; codecs="avc1.64001E, mp4a.40.2"' },
      { src: videoUrl, type: 'video/mp4; codecs="avc1.4D401E, mp4a.40.2"' },
      { src: videoUrl, type: 'video/mp4; codecs="mp4v.20.8, mp4a.40.2"' },
      { src: videoUrl, type: 'video/mp4; codecs="avc1.42E01E"' },
      { src: videoUrl, type: 'video/mp4' },
      
      // Try other common formats in case URL detection was wrong
      { src: videoUrl, type: 'video/webm; codecs="vp8, vorbis"' },
      { src: videoUrl, type: 'video/webm' },
      { src: videoUrl, type: 'video/quicktime' },
      { src: videoUrl, type: 'video/x-msvideo' },
      
      // Generic fallbacks
      { src: videoUrl, type: 'video/*' },
      { src: videoUrl, type: 'application/octet-stream' },
      { src: videoUrl, type: '' } // No type - let browser decide
    ];
    
    let sourcesWorking = 0;
    
    aggressiveSources.forEach((source, index) => {
      const sourceElement = document.createElement('source');
      sourceElement.src = source.src;
      if (source.type) {
        sourceElement.type = source.type;
      }
      
      sourceElement.onerror = function(e) {
        console.warn(`Content-Type workaround source ${index + 1} failed (${source.type || 'no type'})`);
      };
      
      sourceElement.onload = function() {
        sourcesWorking++;
        console.log(`Content-Type workaround source ${index + 1} loaded successfully`);
      };
      
      videoElement.appendChild(sourceElement);
    });
    
    // Set direct src as fallback (most important for Content-Type issues)
    videoElement.src = videoUrl;
    
    // Add event handlers
    videoElement.onloadedmetadata = function() {
      console.log('✅ Content-Type workaround successful!');
      logVideoElementState(videoElement, 'CONTENT_TYPE_WORKAROUND_SUCCESS');
      
      // Try to initialize Plyr
      if (window.Plyr) {
        try {
          currentPlayer = new Plyr(videoElement, {
            controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
            crossorigin: false // Avoid CORS issues
          });
          console.log('Plyr initialized for Content-Type workaround video');
        } catch (e) {
          console.warn('Plyr initialization failed for Content-Type workaround video:', e);
        }
      }
    };
    
    videoElement.onerror = function(e) {
      console.error('❌ Content-Type workaround also failed');
      logVideoElementState(videoElement, 'CONTENT_TYPE_WORKAROUND_FAILED');
      
      // Show error message as last resort
      videoPlayer.innerHTML = errorMessage;
      videoPlayer.style.display = 'block';
      videoEmbed.style.display = 'none';
    };
    
    videoElement.oncanplay = function() {
      console.log('✅ Content-Type workaround: Video can play!');
    };
    
    // Add video element to player
    videoPlayer.appendChild(videoElement);
    
    // Try to load
    try {
      videoElement.load();
    } catch (error) {
      console.error('Error loading Content-Type workaround video:', error);
      videoPlayer.innerHTML = errorMessage;
    }
  }
  
  /**
   * Setup video for S3 URLs with specific optimizations
   * @param {HTMLElement} videoElement - The video element
   * @param {string} videoUrl - The S3 video URL
   * @param {string} videoType - The MIME type
   */
  function setupS3Video(videoElement, videoUrl, videoType) {
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
    
    // Simplified S3 video setup - try the most likely formats first
    // Start with the most basic approach - direct src assignment
    // This often works better than multiple source elements
    videoElement.src = videoUrl;
    
    // Only add a few essential source elements as backup
    const essentialSources = [
      { src: videoUrl, type: 'video/mp4' },
      { src: videoUrl, type: 'video/*' },
      { src: videoUrl, type: '' } // Let browser auto-detect
    ];
    
    essentialSources.forEach((source, index) => {
      const sourceElement = document.createElement('source');
      sourceElement.src = source.src;
      if (source.type) {
        sourceElement.type = source.type;
      }
      
      sourceElement.onerror = function(e) {
        // Only log if multiple sources fail
        if (index > 1) console.warn(`Multiple video sources failed`);
      };
      
      videoElement.appendChild(sourceElement);
    });
    
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
          // Remove blank video fallback - it's confusing when debugging
          blankVideo: '',
          // Conditionally set crossorigin based on whether we're dealing with CORS issues
          crossorigin: !isS3Url(videoElement.src || videoElement.currentSrc) || 
                      (videoElement.getAttribute('crossorigin') !== null),
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
        
        // Add essential event listeners
        currentPlayer.on('ready', () => {
          // Player ready - no logging needed
        });
        
        currentPlayer.on('error', (event) => {
          console.error('🚫 Plyr error:', event);
          console.error('Player state:', {
            source: currentPlayer.source,
            currentTime: currentPlayer.currentTime,
            duration: currentPlayer.duration,
            paused: currentPlayer.paused
          });
        });
        
        currentPlayer.on('loadedmetadata', () => {
          // Metadata loaded - no logging needed
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
  
  // VideoPlayer module ready
})();