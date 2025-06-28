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
  const { formatViews, formatDate, formatVideoTitle, extractUUID } = window.replayHub.utils;
  const BASE_URL = window.BASE_URL;

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
    
    // Store video data globally for edit functionality
    window.currentVideoData = videoData;
    
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
    
    // Update uploader
    const uploaderName = videoData.uploader || videoData.uploader_username || 'Unknown';
    updateElement('video-uploader', `by ${uploaderName}`);
    
    // Update description
    updateElement('video-description', videoData.description);
    
    // Update players section
    updatePlayersSection(videoData.players);
    
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
    
    // Show edit controls if current user is the uploader
    showEditControlsIfOwner(videoData);
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

  /**
   * Update players section
   * @param {Array} players - Array of player names
   */
  function updatePlayersSection(players) {
    const playersSection = document.getElementById('players-section');
    const videoPlayers = document.getElementById('video-players');
    
    if (players && players.length > 0) {
      // Show players section
      if (playersSection) {
        playersSection.style.display = 'block';
      }
      
      // Update players content
      if (videoPlayers) {
        videoPlayers.innerHTML = players.map(player => 
          `<span class="player-tag">${player}</span>`
        ).join('');
      }
    } else {
      // Hide players section if no players
      if (playersSection) {
        playersSection.style.display = 'none';
      }
    }
  }

  /**
   * Show edit controls if the current user is the video owner
   * @param {object} videoData - The video metadata object
   */
  function showEditControlsIfOwner(videoData) {
    console.log('🔍 Checking video ownership...');
    
    // Get current user from auth module
    let currentUser = null;
    if (window.replayHub && window.replayHub.auth) {
      currentUser = window.replayHub.auth.getCurrentUser();
      console.log('📱 Got user from replayHub.auth:', currentUser);
    } else if (window.currentUser) {
      currentUser = window.currentUser;
      console.log('📱 Got user from window.currentUser:', currentUser);
    }
    
    if (!currentUser) {
      console.log('❌ No current user found for owner check');
      console.log('Auth state:', {
        'window.replayHub': !!window.replayHub,
        'window.replayHub.auth': !!(window.replayHub && window.replayHub.auth),
        'window.replayHub.authState': window.replayHub?.authState,
        'window.currentUser': !!window.currentUser
      });
      return;
    }
    
    console.log('📹 Video data for ownership check:', {
      id: videoData.id,
      uploader_id: videoData.uploader_id,
      uploader_username: videoData.uploader_username,
      uploader: videoData.uploader,
      user_id: videoData.user_id,
      title: videoData.title
    });
    
    console.log('👤 Current user data:', {
      id: currentUser.id,
      username: currentUser.username,
      display_name: currentUser.display_name,
      email: currentUser.email
    });
    
    // Check if current user is the uploader using multiple strategies
    const isOwner = videoData.uploader_id === currentUser.id ||
                   videoData.uploader_username === currentUser.username ||
                   videoData.uploader === currentUser.username ||
                   videoData.uploader === currentUser.display_name ||
                   videoData.user_id === currentUser.id;
    
    console.log('🔐 Ownership check result:', {
      'uploader_id === currentUser.id': videoData.uploader_id === currentUser.id,
      'uploader_username === currentUser.username': videoData.uploader_username === currentUser.username,
      'uploader === currentUser.username': videoData.uploader === currentUser.username,
      'uploader === currentUser.display_name': videoData.uploader === currentUser.display_name,
      'user_id === currentUser.id': videoData.user_id === currentUser.id,
      'FINAL_RESULT': isOwner
    });
    
    if (isOwner) {
      console.log('✅ User is owner! Adding edit controls...');
      addEditControls(videoData);
    } else {
      console.log('❌ User is not owner. No edit controls will be shown.');
    }
  }

  /**
   * Add edit controls to the video UI
   * @param {object} videoData - The video metadata object
   */
  function addEditControls(videoData) {
    console.log('🎛️ Adding edit controls for video owner...');
    
    // Show owner controls panel with improved layout
    showOwnerControlsPanel();
    
    // Add edit button to title
    addEditButtonToTitle();
    
    // Add edit button to description
    addEditButtonToDescription();
    
    // Add edit button for players
    addEditButtonToPlayers(videoData);
    
    // Initialize owner control buttons
    initializeOwnerControlButtons();
    
    console.log('✅ Edit controls setup complete!');
  }

  /**
   * Show owner controls panel with improved layout
   */
  function showOwnerControlsPanel() {
    console.log('👑 Showing owner controls panel...');
    const ownerControls = document.getElementById('owner-controls');
    if (ownerControls) {
      // Update the owner controls HTML with just the subtle more options
      ownerControls.innerHTML = `
        <div class="subtle-owner-controls">
          <div class="more-options-container">
            <button id="more-options-btn" class="subtle-more-options-btn" title="Owner options">
              <i class="fas fa-ellipsis-h"></i>
            </button>
            <div id="more-options-menu" class="more-options-menu" style="display: none;">
              <button id="edit-metadata-btn" class="more-option-item">
                <i class="fas fa-edit"></i>
                Quick Edit
              </button>
              <button id="delete-video-btn" class="more-option-item delete-option">
                <i class="fas fa-trash"></i>
                Delete Video
              </button>
            </div>
          </div>
        </div>
      `;
      
      ownerControls.style.display = 'block';
      
      // Add event listener for the "More Options" button
      const moreOptionsBtn = document.getElementById('more-options-btn');
      const moreOptionsMenu = document.getElementById('more-options-menu');
      if (moreOptionsBtn && moreOptionsMenu) {
        moreOptionsBtn.onclick = (e) => {
          e.stopPropagation();
          const isVisible = moreOptionsMenu.style.display !== 'none';
          moreOptionsMenu.style.display = isVisible ? 'none' : 'block';
        };
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
          if (!moreOptionsBtn.contains(e.target) && !moreOptionsMenu.contains(e.target)) {
            moreOptionsMenu.style.display = 'none';
          }
        });
      }
      
      console.log('✅ Owner controls panel shown');
    } else {
      console.log('❌ Owner controls panel not found in DOM');
    }
  }

  /**
   * Add edit button to the video title
   */
  function addEditButtonToTitle() {
    console.log('📝 Adding title edit button...');
    const editBtn = document.getElementById('edit-title-btn');
    if (editBtn) {
      editBtn.style.display = 'inline-flex';
      editBtn.style.alignItems = 'center';
      editBtn.style.marginLeft = '8px';
      editBtn.onclick = () => startInlineEdit('title');
      console.log('✅ Title edit button shown');
    } else {
      console.log('❌ Title edit button not found in DOM');
    }
  }

  /**
   * Add edit button to the video description
   */
  function addEditButtonToDescription() {
    console.log('📄 Adding description edit button...');
    const editBtn = document.getElementById('edit-description-btn');
    if (editBtn) {
      editBtn.style.display = 'inline-flex';
      editBtn.style.alignItems = 'center';
      editBtn.style.marginLeft = '8px';
      editBtn.onclick = () => startInlineEdit('description');
      console.log('✅ Description edit button shown');
    } else {
      console.log('❌ Description edit button not found in DOM');
    }
  }

  /**
   * Add edit button for players
   * @param {object} videoData - The video metadata object
   */
  function addEditButtonToPlayers(videoData) {
    console.log('👥 Adding players edit button...');
    const editBtn = document.getElementById('edit-players-btn');
    if (editBtn) {
      editBtn.style.display = 'inline-flex';
      editBtn.style.alignItems = 'center';
      editBtn.style.marginLeft = '8px';
      editBtn.onclick = () => startInlineEdit('players');
      console.log('✅ Players edit button shown');
    } else {
      console.log('❌ Players edit button not found in DOM');
    }
  }

  /**
   * Initialize owner control buttons
   */
  function initializeOwnerControlButtons() {
    console.log('🔧 Initializing owner control buttons...');
    
    // Initialize edit metadata button (for quick access to all fields)
    const editMetadataBtn = document.getElementById('edit-metadata-btn');
    if (editMetadataBtn) {
      editMetadataBtn.onclick = () => showQuickEditMenu();
      console.log('✅ Edit metadata button initialized');
    }

    // Initialize delete video button (will be in the more options menu)
    const deleteVideoBtn = document.getElementById('delete-video-btn');
    if (deleteVideoBtn) {
      deleteVideoBtn.onclick = () => confirmDeleteVideo();
      console.log('✅ Delete video button initialized');
    }
  }

  /**
   * Show quick edit menu
   */
  function showQuickEditMenu() {
    const actions = [
      { label: 'Edit Title', action: () => startInlineEdit('title') },
      { label: 'Edit Description', action: () => startInlineEdit('description') },
      { label: 'Edit Players', action: () => startInlineEdit('players') }
    ];

    // Create a simple dropdown menu
    const menu = document.createElement('div');
    menu.className = 'quick-edit-menu';
    menu.innerHTML = `
      <div class="quick-edit-header">Quick Edit</div>
      ${actions.map(action => `
        <button class="quick-edit-option" data-action="${action.label}">
          ${action.label}
        </button>
      `).join('')}
    `;

    // Position near the edit button
    const editBtn = document.getElementById('edit-metadata-btn');
    const rect = editBtn.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.left = rect.left + 'px';
    menu.style.zIndex = '1000';

    document.body.appendChild(menu);

    // Add click handlers
    menu.querySelectorAll('.quick-edit-option').forEach((option, index) => {
      option.onclick = () => {
        actions[index].action();
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
      };
    });

    // Close menu when clicking outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target) && !editBtn.contains(e.target)) {
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
  }

  /**
   * Start inline editing for a field
   * @param {string} field - The field to edit ('title', 'description', 'players')
   */
  function startInlineEdit(field) {
    console.log(`🖊️ Starting inline edit for ${field}`);
    
    let elementId, currentValue, isTextarea = false;
    
    switch (field) {
      case 'title':
        elementId = 'video-title';
        currentValue = window.currentVideoData?.title || '';
        break;
      case 'description':
        elementId = 'video-description';
        currentValue = window.currentVideoData?.description || '';
        isTextarea = true;
        break;
      case 'players':
        elementId = 'video-players';
        currentValue = window.currentVideoData?.players?.join(', ') || '';
        break;
      default:
        console.error('Unknown field:', field);
        return;
    }
    
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element not found: ${elementId}`);
      return;
    }
    
    // Store original content
    const originalContent = element.innerHTML;
    
    // Create input element
    const inputElement = document.createElement(isTextarea ? 'textarea' : 'input');
    inputElement.type = isTextarea ? undefined : 'text';
    inputElement.value = currentValue;
    inputElement.className = `inline-edit-${field}`;
    
    // Style the input
    inputElement.style.width = '100%';
    inputElement.style.fontSize = window.getComputedStyle(element).fontSize;
    inputElement.style.fontFamily = window.getComputedStyle(element).fontFamily;
    inputElement.style.color = window.getComputedStyle(element).color;
    inputElement.style.background = 'rgba(255, 255, 255, 0.1)';
    inputElement.style.border = '2px solid #007cba';
    inputElement.style.borderRadius = '4px';
    inputElement.style.padding = '8px';
    inputElement.style.outline = 'none';
    
    if (isTextarea) {
      inputElement.style.minHeight = '80px';
      inputElement.style.resize = 'vertical';
    }
    
    // Replace element content with input
    element.innerHTML = '';
    element.appendChild(inputElement);
    
    // Add save/cancel buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'inline-edit-buttons';
    buttonContainer.innerHTML = `
      <button class="inline-edit-save" title="Save">
        <i class="fas fa-check"></i>
      </button>
      <button class="inline-edit-cancel" title="Cancel">
        <i class="fas fa-times"></i>
      </button>
    `;
    element.appendChild(buttonContainer);
    
    // Focus and select the input
    inputElement.focus();
    inputElement.select();
    
    // Handle save
    const saveEdit = async () => {
      const newValue = inputElement.value.trim();
      
      if (newValue !== currentValue) {
        try {
          let processedValue = newValue;
          if (field === 'players') {
            processedValue = newValue.split(',').map(p => p.trim()).filter(p => p);
          }
          
          const success = await updateVideoField(field, processedValue);
          if (success) {
            // Update the global video data
            if (field === 'players') {
              window.currentVideoData.players = processedValue;
              updatePlayersSection(processedValue);
            } else {
              window.currentVideoData[field] = newValue;
              element.innerHTML = newValue;
            }
            
            if (field === 'title') {
              document.title = `${newValue} - Replay Hub`;
            }
            
            showMessage(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`, 'success');
          } else {
            throw new Error('Update failed');
          }
        } catch (error) {
          console.error(`Error updating ${field}:`, error);
          showMessage(`Failed to update ${field}`, 'error');
          element.innerHTML = originalContent;
        }
      } else {
        // No changes, just restore
        element.innerHTML = originalContent;
      }
    };
    
    // Handle cancel
    const cancelEdit = () => {
      element.innerHTML = originalContent;
    };
    
    // Add event listeners
    buttonContainer.querySelector('.inline-edit-save').onclick = saveEdit;
    buttonContainer.querySelector('.inline-edit-cancel').onclick = cancelEdit;
    
    // Save on Enter (except for textarea), cancel on Escape
    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !isTextarea) {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });
  }

  /**
   * Confirm delete video with proper warning
   */
  function confirmDeleteVideo() {
    if (!window.currentVideoData) {
      showMessage('Video data not available', 'error');
      return;
    }

    // Create confirmation modal
    const modal = document.createElement('div');
    modal.className = 'delete-confirmation-modal';
    modal.innerHTML = `
      <div class="delete-confirmation-backdrop"></div>
      <div class="delete-confirmation-content">
        <div class="delete-confirmation-header">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Delete Video</h3>
        </div>
        <div class="delete-confirmation-body">
          <p><strong>Are you sure you want to delete this video?</strong></p>
          <p class="video-title-preview">"${window.currentVideoData.title}"</p>
          <div class="delete-warning">
            <i class="fas fa-warning"></i>
            This action cannot be undone. The video, all comments, reactions, and saved bookmarks will be permanently deleted.
          </div>
        </div>
        <div class="delete-confirmation-actions">
          <button class="delete-cancel-btn">Cancel</button>
          <button class="delete-confirm-btn">
            <i class="fas fa-trash"></i>
            Delete Permanently
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelector('.delete-cancel-btn').onclick = () => {
      document.body.removeChild(modal);
    };

    modal.querySelector('.delete-confirm-btn').onclick = async () => {
      try {
        await deleteVideo();
        document.body.removeChild(modal);
      } catch (error) {
        console.error('Delete failed:', error);
        // Keep modal open on error
      }
    };

    // Close on backdrop click
    modal.querySelector('.delete-confirmation-backdrop').onclick = () => {
      document.body.removeChild(modal);
    };

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Delete the video
   */
  async function deleteVideo() {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }
    
    try {
      // Get auth token from auth module
      let token = null;
      if (window.replayHub && window.replayHub.auth) {
        const options = window.replayHub.auth.addAuthToRequest({});
        token = options.headers?.Authorization?.replace('Bearer ', '');
      }
      
      if (!token) {
        token = localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token');
      }
      
      const response = await fetch(`${window.BASE_URL}/api/videos/${window.currentVideoData.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      showMessage('Video deleted successfully!', 'success');
      
      // Redirect to home page after a delay
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting video:', error);
      showMessage('Failed to delete video', 'error');
    }
  }

  /**
   * Show a message to the user
   * @param {string} message - The message to show
   * @param {string} type - The message type (success, error, info)
   */
  function showMessage(message, type) {
    if (window.showMessage) {
      window.showMessage(message, type);
    } else {
      alert(message);
    }
  }

  /**
   * Update a video field on the server
   * @param {string} field - The field to update
   * @param {any} value - The new value
   * @returns {Promise<boolean>} - Success status
   */
  async function updateVideoField(field, value) {
    try {
      // Get auth token from auth module
      let token = null;
      if (window.replayHub && window.replayHub.auth) {
        const options = window.replayHub.auth.addAuthToRequest({});
        token = options.headers?.Authorization?.replace('Bearer ', '');
      }
      
      if (!token) {
        token = localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token');
      }
      
             const response = await fetch(`${window.BASE_URL}/api/videos/${window.currentVideoData.id}`, {
         method: 'PUT',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`
         },
        body: JSON.stringify({
          [field]: value
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error updating video field:', error);
      throw error;
    }
  }

  // Export metadata functions
  window.replayHub.videoMetadata = {
    fetchVideoDetails,
    updateVideoUI
  };

  // VideoMetadata module ready
})();