/**
 * Video metadata management for Replay Hub
 */

// Initialize the global replayHub object if needed
window.replayHub = window.replayHub || {};

// Initialize the module immediately using an IIFE
(function() {
  // Check if utils module is loaded
  if (!window.replayHub.utils) {
    console.error('Utils module not loaded - videoMetadata cannot initialize');
    return;
  }

  // Get utility functions from the utils module
  const { BASE_URL, formatViews, formatDate, formatVideoTitle, extractUUID } = window.replayHub.utils;

  /**
   * Fetch video details from the server
   * @param {string} videoId - The ID of the video
   * @returns {Promise<Object>} - The video data
   */
  async function fetchVideoDetails(videoId) {
    try {
      // Get the S3 URL which may contain useful information
      const urlParams = new URLSearchParams(window.location.search);
      const s3Url = urlParams.get('s3_url');
      
      // Extract a potentially more useful ID from the S3 URL
      const extractedId = extractIdFromUrl(s3Url);
      
      // Try to find the video with multiple strategies
      let videoData = await findVideoInList(videoId, extractedId, s3Url);
      
      // If not found in list, try direct endpoints
      if (!videoData) {
        videoData = await tryDirectEndpoints(videoId, extractedId);
      }
      
      // If still not found, create a fallback object based on URL
      if (!videoData && s3Url) {
        videoData = createFallbackVideo(videoId, extractedId, s3Url);
      }
      
      if (!videoData) {
        throw new Error('Video not found');
      }
      
      return videoData;
    } catch (error) {
      console.error('Error fetching video details:', error);
      return createErrorVideo(videoId);
    }
  }

  /**
   * Extract a potentially useful ID from the video URL
   * @param {string} s3Url - The S3 URL of the video
   * @returns {string|null} - The extracted ID
   */
  function extractIdFromUrl(s3Url) {
    if (!s3Url) return null;
    
    const s3UrlParts = s3Url.split('/');
    const filename = s3UrlParts[s3UrlParts.length - 1];
    const filenameWithoutExt = filename.split('.')[0];
    
    // Try to extract UUID pattern
    const extractedId = extractUUID(filenameWithoutExt);
    
    // If no UUID pattern found, just use the filename without extension
    return extractedId || filenameWithoutExt;
  }

  /**
   * Try to find video in the complete video list
   * @param {string} videoId - The original video ID
   * @param {string} extractedId - The ID extracted from the URL
   * @param {string} s3Url - The S3 URL of the video
   * @returns {Promise<Object|null>} - The video data if found
   */
  async function findVideoInList(videoId, extractedId, s3Url) {
    try {
      // Get all videos and find a match
      const response = await fetch(`${BASE_URL}/metadata`);
      if (!response.ok) return null;
      
      const allVideos = await response.json();
      
      // Try various matching strategies
      const matchingVideo = findMatchingVideo(allVideos, videoId, extractedId, s3Url);
      
      if (matchingVideo) {
        // Save the actual ID from the server for later use
        try {
          localStorage.setItem(`video_id_map_${videoId}`, matchingVideo.id);
        } catch (e) {
          // Ignore localStorage errors
        }
        return matchingVideo;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding video in list:', error);
      return null;
    }
  }

  /**
   * Find a matching video using various strategies
   * @param {Array} videos - The list of videos
   * @param {string} videoId - The original video ID
   * @param {string} extractedId - The ID extracted from the URL
   * @param {string} s3Url - The S3 URL of the video
   * @returns {Object|null} - The matching video
   */
  function findMatchingVideo(videos, videoId, extractedId, s3Url) {
    if (!videos || !videos.length) return null;

    // 1. Try exact ID match
    let match = videos.find(video => video.id === videoId);
    
    // 2. Try with extracted ID
    if (!match && extractedId) {
      match = videos.find(video => video.id === extractedId);
    }
    
    // 3. Try normalized IDs (without dashes)
    if (!match) {
      const normalizedVideoId = (videoId || '').replace(/-/g, '').toLowerCase();
      const normalizedExtractedId = extractedId ? extractedId.replace(/-/g, '').toLowerCase() : '';
      
      match = videos.find(video => {
        if (!video.id) return false;
        const normalizedId = video.id.replace(/-/g, '').toLowerCase();
        
        return normalizedId.includes(normalizedVideoId) || 
               normalizedVideoId.includes(normalizedId) ||
               (normalizedExtractedId && (normalizedId.includes(normalizedExtractedId) || 
                                        normalizedExtractedId.includes(normalizedId)));
      });
    }
    
    // 4. Try matching by internal_name
    if (!match && extractedId) {
      match = videos.find(video => 
        video.internal_name && (
          video.internal_name === extractedId || 
          video.internal_name.replace(/-/g, '') === extractedId.replace(/-/g, '')
        )
      );
    }
    
    // 5. Try matching by s3_url
    if (!match && s3Url) {
      match = videos.find(video => 
        video.s3_url && decodeURIComponent(video.s3_url) === decodeURIComponent(s3Url)
      );
    }
    
    return match;
  }

  /**
   * Try direct API endpoints to fetch video
   * @param {string} videoId - The original video ID
   * @param {string} extractedId - The ID extracted from the URL
   * @returns {Promise<Object|null>} - The video data if found
   */
  async function tryDirectEndpoints(videoId, extractedId) {
    try {
      // Try with extracted ID first if it's different from the original
      if (extractedId && extractedId !== videoId) {
        const response = await fetch(`${BASE_URL}/metadata/${extractedId}`);
        if (response.ok) {
          return await response.json();
        }
      }
      
      // Try with the original ID
      const response = await fetch(`${BASE_URL}/metadata/${videoId}`);
      if (response.ok) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error('Error trying direct endpoints:', error);
      return null;
    }
  }

  /**
   * Create fallback video object from URL
   * @param {string} videoId - The original video ID
   * @param {string} extractedId - The ID extracted from the URL
   * @param {string} s3Url - The S3 URL of the video
   * @returns {Object} - A fallback video object
   */
  function createFallbackVideo(videoId, extractedId, s3Url) {
    if (!s3Url) return null;
    
    const filename = s3Url.split('/').pop().split('?')[0];
    const decodedFilename = decodeURIComponent(filename.replace(/\+/g, ' '));
    
    return {
      id: extractedId || videoId,
      title: formatVideoTitle(decodedFilename),
      description: "This video was found in storage but its metadata could not be retrieved from the database.",
      s3_url: s3Url,
      upload_date: new Date().toISOString(),
      views: 0,
      likes: 0,
      dislikes: 0
    };
  }

  /**
   * Create error state video object
   * @param {string} videoId - The video ID
   * @returns {Object} - An error state video object
   */
  function createErrorVideo(videoId) {
    return {
      id: videoId,
      title: 'Video not found',
      description: 'This video could not be found in the database.',
      upload_date: new Date().toISOString(),
      views: 0,
      likes: 0,
      dislikes: 0,
      error: true
    };
  }

  /**
   * Update the video UI with the fetched metadata
   * @param {object} videoData - The video metadata object
   */
  function updateVideoUI(videoData) {
    if (!videoData) return;
    
    // Update title
    updateElement('video-title', videoData.title);
    
    // Update views
    if (typeof videoData.views !== 'undefined') {
      updateElement('video-views', `${formatViews(videoData.views)} views`);
    }
    
    // Update date
    if (videoData.upload_date) {
      updateElement('video-date', formatDate(new Date(videoData.upload_date)));
    }
    
    // Update description
    updateElement('video-description', videoData.description);
    
    // Update like button
    updateLikeButton('like-button', videoData.likes);
    
    // Update dislike button
    updateLikeButton('dislike-button', videoData.dislikes);
    
    // Update page title
    if (videoData.title) {
      document.title = `${videoData.title} - Replay Hub`;
    }
    
    // Set video poster if thumbnail is available
    if (videoData.thumbnail_id) {
      updateThumbnail(videoData.thumbnail_id);
    }
  }

  /**
   * Update a DOM element's text content
   * @param {string} elementId - The element ID
   * @param {string} content - The content to set
   */
  function updateElement(elementId, content) {
    const element = document.getElementById(elementId);
    if (element && content) {
      element.textContent = content;
    }
  }

  /**
   * Update like/dislike button
   * @param {string} buttonId - The button ID
   * @param {number} count - The count to display
   */
  function updateLikeButton(buttonId, count) {
    if (typeof count === 'undefined') return;
    
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    const span = button.querySelector('span');
    if (span) {
      const isLike = buttonId === 'like-button';
      const text = count > 0 ? `${formatViews(count)} ${isLike ? 'Likes' : 'Dislikes'}` : (isLike ? 'Like' : 'Dislike');
      span.textContent = text;
    }
  }

  /**
   * Update video thumbnail
   * @param {string} thumbnailId - The thumbnail ID
   */
  function updateThumbnail(thumbnailId) {
    const thumbnailUrl = `${BASE_URL}/thumbnail/${thumbnailId}`;
    
    const player = document.getElementById('video-player');
    if (player) {
      player.poster = thumbnailUrl;
      
      // If we're using VideoJS
      const vjsPlayer = window.videojs && window.videojs.getPlayer('video-player');
      if (vjsPlayer) {
        vjsPlayer.poster(thumbnailUrl);
      }
    }
  }

  // Export metadata functions
  window.replayHub.videoMetadata = {
    fetchVideoDetails,
    updateVideoUI
  };

  // Signal that this module is ready
  console.log('VideoMetadata module initialized');
})();