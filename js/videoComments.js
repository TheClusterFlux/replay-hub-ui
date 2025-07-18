/**
 * Comments and reactions functionality for Replay Hub
 */

// Initialize the global replayHub object if needed
window.replayHub = window.replayHub || {};

// Initialize the module immediately using an IIFE
(function() {
  // Check if utils module is loaded
  if (!window.replayHub.utils) {
    console.error('Utils module not loaded - videoComments cannot initialize');
    return;
  }

  // Get utility functions from the utils module
  const { BASE_URL, formatDate, formatViews } = window.replayHub.utils;

  /**
   * Initialize comments functionality for a video
   * @param {string} videoId - The ID of the video
   */  async function initComments(videoId) {
    try {
      // Update the avatar based on the current user
      updateCommentAvatar();
      
      // Set up the comment form
      setupCommentForm(videoId);
      
      // Load initial comments
      await loadComments(videoId);
    } catch (error) {
      console.error('Error initializing comments:', error);
    }
  }
  
  /**
   * Update the comment avatar with the current user's first initial
   */
  function updateCommentAvatar() {
    const commentAvatar = document.getElementById('comment-avatar');
    if (!commentAvatar) return;
    
    const currentUser = window.currentUser || { name: 'Guest User' };
    const initial = currentUser.name.charAt(0).toUpperCase();
    
    commentAvatar.textContent = initial;
    
    // Add a special class if the user is logged in
    if (currentUser.isLoggedIn) {
      commentAvatar.classList.add('logged-in');
    } else {
      commentAvatar.classList.remove('logged-in');
    }
  }

  /**
   * Set up the comment form with event handlers
   * @param {string} videoId - The ID of the video
   */
  function setupCommentForm(videoId) {
    const commentForm = document.getElementById('comment-form');
    const commentInput = document.getElementById('comment-input');
    const commentActions = document.getElementById('comment-actions');
    
    if (!commentForm || !commentInput) return;
    
    // Show actions when input is focused
    commentInput.addEventListener('focus', () => {
      if (commentActions) commentActions.style.display = 'flex';
    });
    
    // Hide actions when cancel is clicked
    const cancelButton = document.getElementById('comment-cancel');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => {
        commentInput.value = '';
        if (commentActions) commentActions.style.display = 'none';
      });
    }
    
    // Handle comment submission
    commentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const commentText = commentInput.value.trim();
      if (!commentText) return;
      
      try {
        await addComment(videoId, commentText);
        commentInput.value = '';
        if (commentActions) commentActions.style.display = 'none';
        
        // Refresh comments
        await loadComments(videoId);
      } catch (error) {
        console.error('Error submitting comment:', error);
      }
    });
  }

  /**
   * Load and display comments for a video
   * @param {string} videoId - The ID of the video
   */
  async function loadComments(videoId) {
    try {
      const commentsListElement = document.getElementById('comments-list');
      if (!commentsListElement) return;
      
      commentsListElement.innerHTML = '<div class="loading">Loading comments...</div>';
      
      const response = await fetch(`${BASE_URL}/comments/${videoId}`);
      if (!response.ok) {
        throw new Error(`Error fetching comments: ${response.status}`);
      }
      
      const comments = await response.json();
      
      // Update comments count
      const commentsCountElement = document.getElementById('comments-count');
      if (commentsCountElement) {
        commentsCountElement.textContent = `${comments.length} Comments`;
      }
      
      // Display comments
      if (comments.length === 0) {
        commentsListElement.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
      } else {
        commentsListElement.innerHTML = '';
        
        comments.forEach(comment => {
          const commentElement = createCommentElement(comment, videoId);
          commentsListElement.appendChild(commentElement);
        });
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      
      const commentsListElement = document.getElementById('comments-list');
      if (commentsListElement) {
        commentsListElement.innerHTML = '<div class="error">Failed to load comments. Please try again later.</div>';
      }
    }
  }

  /**
   * Create a DOM element for a comment
   * @param {Object} comment - The comment data
   * @param {string} videoId - The ID of the video
   * @returns {HTMLElement} - The comment element
   */
  function createCommentElement(comment, videoId) {
    const commentContainer = document.createElement('div');
    commentContainer.className = 'comment';
    commentContainer.dataset.commentId = comment.id;
    
    // Header with avatar and metadata
    const header = document.createElement('div');
    header.className = 'comment-header';
    
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = comment.username.charAt(0).toUpperCase();
    
    const metadata = document.createElement('div');
    metadata.className = 'comment-metadata';
    
    const username = document.createElement('div');
    username.className = 'comment-username';
    username.textContent = comment.username;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'comment-timestamp';
    timestamp.textContent = formatDate(new Date(comment.timestamp));
    
    metadata.appendChild(username);
    metadata.appendChild(timestamp);
    header.appendChild(avatar);
    header.appendChild(metadata);
    
    // Comment body
    const body = document.createElement('div');
    body.className = 'comment-body';
    body.textContent = comment.text;
    
    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'comment-actions';
    
    const likeButton = createActionButton('like', comment.likes || 0, () => handleCommentReaction(comment.id, videoId, 'like'));
    const dislikeButton = createActionButton('dislike', comment.dislikes || 0, () => handleCommentReaction(comment.id, videoId, 'dislike'));
    const replyButton = createActionButton('reply', 'Reply', () => showReplyForm(comment.id, videoId), true);
    
    actions.appendChild(likeButton);
    actions.appendChild(dislikeButton);
    actions.appendChild(replyButton);
    
    // Add delete button if current user is video owner
    if (isVideoOwner()) {
      const deleteButton = createActionButton('delete', 'Delete', () => deleteComment(comment.id, videoId));
      actions.appendChild(deleteButton);
    }
    
    // Assemble comment
    commentContainer.appendChild(header);
    commentContainer.appendChild(body);
    commentContainer.appendChild(actions);
    
    // Add replies if any
    if (comment.replies && comment.replies.length > 0) {
      const repliesContainer = document.createElement('div');
      repliesContainer.className = 'comment-replies';
      
      comment.replies.forEach(reply => {
        const replyElement = createReplyElement(reply, comment.id, videoId);
        repliesContainer.appendChild(replyElement);
      });
      
      commentContainer.appendChild(repliesContainer);
    }
    
    // Add container for reply form
    const replyFormContainer = document.createElement('div');
    replyFormContainer.className = 'reply-form-container';
    replyFormContainer.style.display = 'none';
    replyFormContainer.dataset.commentId = comment.id;
    commentContainer.appendChild(replyFormContainer);
    
    return commentContainer;
  }

  /**
   * Create a reply element
   * @param {Object} reply - The reply data
   * @param {string} parentId - The parent comment ID
   * @param {string} videoId - The video ID
   * @returns {HTMLElement} - The reply element
   */
  function createReplyElement(reply, parentId, videoId) {
    const replyContainer = document.createElement('div');
    replyContainer.className = 'reply';
    replyContainer.dataset.replyId = reply.id;
    
    // Header with avatar and metadata
    const header = document.createElement('div');
    header.className = 'reply-header';
    
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar small';
    avatar.textContent = reply.username.charAt(0).toUpperCase();
    
    const metadata = document.createElement('div');
    metadata.className = 'reply-metadata';
    
    const username = document.createElement('div');
    username.className = 'reply-username';
    username.textContent = reply.username;
    
    const timestamp = document.createElement('div');
    timestamp.className = 'reply-timestamp';
    timestamp.textContent = formatDate(new Date(reply.timestamp));
    
    metadata.appendChild(username);
    metadata.appendChild(timestamp);
    header.appendChild(avatar);
    header.appendChild(metadata);
    
    // Reply body
    const body = document.createElement('div');
    body.className = 'reply-body';
    body.textContent = reply.text;
    
    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'reply-actions';
    
    const likeButton = createActionButton('like', reply.likes || 0, () => handleReplyReaction(reply.id, videoId, 'like'));
    const dislikeButton = createActionButton('dislike', reply.dislikes || 0, () => handleReplyReaction(reply.id, videoId, 'dislike'));
    
    actions.appendChild(likeButton);
    actions.appendChild(dislikeButton);
    
    // Add delete button if current user is video owner
    if (isVideoOwner()) {
      const deleteButton = createActionButton('delete', 'Delete', () => deleteReply(reply.id, videoId));
      actions.appendChild(deleteButton);
    }
    
    // Assemble reply
    replyContainer.appendChild(header);
    replyContainer.appendChild(body);
    replyContainer.appendChild(actions);
    
    return replyContainer;
  }

  /**
   * Create an action button (like/dislike/reply)
   * @param {string} action - The action type
   * @param {string|number} text - Text or count to display
   * @param {Function} handler - Click event handler
   * @param {boolean} isReply - Whether this is a reply button
   * @returns {HTMLElement} - The button element
   */
  function createActionButton(action, text, handler, isReply = false) {
    const button = document.createElement('button');
    button.className = isReply ? 'comment-action' : 'comment-action';
    if (action === 'delete') {
      button.className += ' delete-action';
    }
    button.dataset.action = action;
    
    if (action === 'like') {
      button.innerHTML = `<i class="far fa-thumbs-up"></i> <span>${text}</span>`;
    } else if (action === 'dislike') {
      button.innerHTML = `<i class="far fa-thumbs-down"></i> <span>${text}</span>`;
    } else if (action === 'reply') {
      button.innerHTML = `<i class="fas fa-reply"></i> ${text}`;
    } else if (action === 'delete') {
      button.innerHTML = `<i class="fas fa-trash"></i> ${text}`;
      button.title = 'Delete this comment';
    }
    
    button.addEventListener('click', handler);
    return button;
  }

  /**
   * Show reply form for a comment
   * @param {string} commentId - The ID of the comment
   * @param {string} videoId - The ID of the video
   */
  function showReplyForm(commentId, videoId) {
    const replyFormContainer = document.querySelector(`.reply-form-container[data-comment-id="${commentId}"]`);
    if (!replyFormContainer) return;
    
    // If form is already open, just focus on it
    const existingForm = replyFormContainer.querySelector('form');
    if (existingForm) {
      replyFormContainer.style.display = 'block';
      existingForm.querySelector('input').focus();
      return;
    }
    
    // Create the form
    const form = document.createElement('form');
    form.className = 'reply-form';
    form.dataset.commentId = commentId;
    
    // Form elements
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'reply-input';
    input.placeholder = 'Add a reply...';
    
    const actions = document.createElement('div');
    actions.className = 'reply-actions';
    
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      replyFormContainer.style.display = 'none';
    });
    
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'submit';
    submitButton.textContent = 'Reply';
    
    actions.appendChild(cancelButton);
    actions.appendChild(submitButton);
    
    form.appendChild(input);
    form.appendChild(actions);
    
    // Form submission handler
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const replyText = input.value.trim();
      if (!replyText) return;
      
      try {
        await addReply(commentId, videoId, replyText);
        replyFormContainer.style.display = 'none';
        
        // Refresh comments
        await loadComments(videoId);
      } catch (error) {
        console.error('Error submitting reply:', error);
      }
    });
    
    // Show the form
    replyFormContainer.innerHTML = '';
    replyFormContainer.appendChild(form);
    replyFormContainer.style.display = 'block';
    input.focus();
  }

  /**
   * Add a comment to a video
   * @param {string} videoId - The ID of the video
   * @param {string} text - The comment text
   * @returns {Promise<Object>} - The created comment
   */  async function addComment(videoId, text) {
    try {
      // Access global currentUser object from window
      const currentUser = window.currentUser || { id: 'guest-user', name: 'Guest User' };
      
      // Check if user is logged in
      if (!currentUser.isLoggedIn) {
        alert('Please log in to add comments.');
        if (window.login) window.login();
        throw new Error('User not logged in');
      }
      
      const response = await fetch(`${BASE_URL}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: currentUser.id,
          username: currentUser.name,
          text,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error adding comment: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  /**
   * Add a reply to a comment
   * @param {string} commentId - The ID of the comment
   * @param {string} videoId - The ID of the video
   * @param {string} text - The reply text
   * @returns {Promise<Object>} - The created reply
   */  async function addReply(commentId, videoId, text) {
    try {
      // Access global currentUser object from window
      const currentUser = window.currentUser || { id: 'guest-user', name: 'Guest User' };
      
      // Check if user is logged in
      if (!currentUser.isLoggedIn) {
        alert('Please log in to reply to comments.');
        if (window.login) window.login();
        throw new Error('User not logged in');
      }
      
      const response = await fetch(`${BASE_URL}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: currentUser.id,
          username: currentUser.name,
          text,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error adding reply: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding reply:', error);
      throw error;
    }
  }

  /**
   * Handle reaction to a comment
   * @param {string} commentId - The comment ID
   * @param {string} videoId - The video ID
   * @param {string} reactionType - The reaction type ('like' or 'dislike')
   * @returns {Promise<Object>} - The updated reaction counts
   */  async function handleCommentReaction(commentId, videoId, reactionType) {
    try {
      // Access global currentUser object from window
      const currentUser = window.currentUser || { id: 'guest-user', name: 'Guest User' };
      
      // Check if user is logged in
      if (!currentUser.isLoggedIn) {
        alert('Please log in to like or dislike comments.');
        if (window.login) window.login();
        throw new Error('User not logged in');
      }
      
      const response = await fetch(`${BASE_URL}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: currentUser.id,
          type: reactionType,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error reacting to comment: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update UI
      updateReactionUI(`.comment[data-comment-id="${commentId}"]`, data);
      
      return data;
    } catch (error) {
      console.error('Error handling comment reaction:', error);
      throw error;
    }
  }

  /**
   * Handle reaction to a reply
   * @param {string} replyId - The reply ID
   * @param {string} videoId - The video ID
   * @param {string} reactionType - The reaction type ('like' or 'dislike')
   * @returns {Promise<Object>} - The updated reaction counts
   */  async function handleReplyReaction(replyId, videoId, reactionType) {
    try {
      // Access global currentUser object from window
      const currentUser = window.currentUser || { id: 'guest-user', name: 'Guest User' };
      
      // Check if user is logged in
      if (!currentUser.isLoggedIn) {
        alert('Please log in to like or dislike replies.');
        if (window.login) window.login();
        throw new Error('User not logged in');
      }
      
      const response = await fetch(`${BASE_URL}/comments/${replyId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: currentUser.id,
          type: reactionType,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error reacting to reply: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update UI
      updateReactionUI(`.reply[data-reply-id="${replyId}"]`, data);
      
      return data;
    } catch (error) {
      console.error('Error handling reply reaction:', error);
      throw error;
    }
  }

  /**
   * Update the reaction counts in the UI
   * @param {string} selector - CSS selector for the element
   * @param {Object} data - Reaction data with counts
   */
  function updateReactionUI(selector, data) {
    const element = document.querySelector(selector);
    if (!element) return;
    
    const likeButton = element.querySelector('[data-action="like"] span');
    const dislikeButton = element.querySelector('[data-action="dislike"] span');
    
    if (likeButton && data.currentLikes !== undefined) {
      likeButton.textContent = data.currentLikes;
    }
    
    if (dislikeButton && data.currentDislikes !== undefined) {
      dislikeButton.textContent = data.currentDislikes;
    }
  }

  /**
   * Initialize reactions (like/dislike) functionality for the video
   * @param {string} videoId - The ID of the video
   */
  async function initReactions(videoId) {
    try {
      const likeButton = document.getElementById('like-button');
      const dislikeButton = document.getElementById('dislike-button');
      
      if (!likeButton || !dislikeButton) return;
      
      // Add event listeners for like/dislike buttons
      likeButton.addEventListener('click', () => handleVideoReaction(videoId, 'like'));
      dislikeButton.addEventListener('click', () => handleVideoReaction(videoId, 'dislike'));
    } catch (error) {
      console.error('Error initializing reactions:', error);
    }
  }

  /**
   * Handle reaction to a video
   * @param {string} videoId - The video ID
   * @param {string} reactionType - The reaction type ('like' or 'dislike')
   * @returns {Promise<Object>} - The updated reaction counts
   */  async function handleVideoReaction(videoId, reactionType) {
    try {
      // Access global currentUser object from window
      const currentUser = window.currentUser || { id: 'guest-user', name: 'Guest User' };
      
      // Check if user is logged in
      if (!currentUser.isLoggedIn) {
        alert('Please log in to like or dislike videos.');
        if (window.login) window.login();
        throw new Error('User not logged in');
      }
      
      const response = await fetch(`${BASE_URL}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: currentUser.id,
          type: reactionType,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error reacting to video: ${response.status}`);
      }
      
      const data = await response.json();
      updateVideoReactionUI(reactionType, data);
      
      return data;
    } catch (error) {
      console.error('Error handling video reaction:', error);
      throw error;
    }
  }

  /**
   * Update the video reaction UI
   * @param {string} reactionType - The reaction type ('like' or 'dislike')
   * @param {Object} data - The reaction data with counts
   */
  function updateVideoReactionUI(reactionType, data) {
    const likeButton = document.getElementById('like-button');
    const dislikeButton = document.getElementById('dislike-button');
    
    if (likeButton && data.currentLikes !== undefined) {
      const likeSpan = likeButton.querySelector('span');
      if (likeSpan) {
        likeSpan.textContent = data.currentLikes > 0 ? 
          `${formatViews(data.currentLikes)} Likes` : 
          'Like';
      }
      
      // Update active state
      if (reactionType === 'like') {
        likeButton.classList.add('active');
        dislikeButton.classList.remove('active');
      } else if (reactionType === 'dislike') {
        likeButton.classList.remove('active');
      }
    }
    
    if (dislikeButton && data.currentDislikes !== undefined) {
      const dislikeSpan = dislikeButton.querySelector('span');
      if (dislikeSpan) {
        dislikeSpan.textContent = data.currentDislikes > 0 ? 
          `${formatViews(data.currentDislikes)} Dislikes` : 
          'Dislike';
      }
      
      // Update active state
      if (reactionType === 'dislike') {
        dislikeButton.classList.add('active');
        likeButton.classList.remove('active');
      } else if (reactionType === 'like') {
        dislikeButton.classList.remove('active');
      }
    }
  }

  /**
   * Initialize save/bookmark functionality for the video
   * @param {string} videoId - The ID of the video
   */
  async function initSaveBookmark(videoId) {
    try {
      const saveButton = document.getElementById('save-button');
      if (!saveButton) return;
      
      // Add event listener for save/bookmark button
      saveButton.addEventListener('click', () => handleSaveVideo(videoId));
      
      // Load current save state if user is logged in
      if (window.currentUser && window.currentUser.isLoggedIn) {
        await loadSaveState(videoId);
      }
    } catch (error) {
      console.error('Error initializing save/bookmark:', error);
    }
  }

  /**
   * Handle saving/bookmarking a video
   * @param {string} videoId - The video ID
   * @returns {Promise<Object>} - The save result
   */
  async function handleSaveVideo(videoId) {
    try {
      // Access global currentUser object from window
      const currentUser = window.currentUser || { id: 'guest-user', name: 'Guest User' };
      
      // Check if user is logged in
      if (!currentUser.isLoggedIn) {
        alert('Please log in to save videos to your watchlist.');
        if (window.login) window.login();
        throw new Error('User not logged in');
      }
      
      const response = await fetch(`${BASE_URL}/api/user/saved-videos`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token')}`
        },
        body: JSON.stringify({
          videoId,
          userId: currentUser.id,
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error saving video: ${response.status}`);
      }
      
      const data = await response.json();
      updateSaveButtonUI(data.saved);
      
      // Show success message
      if (window.showMessage) {
        window.showMessage(data.saved ? 'Video saved to your watchlist!' : 'Video removed from your watchlist!', 'success');
      } else {
        alert(data.saved ? 'Video saved to your watchlist!' : 'Video removed from your watchlist!');
      }
      
      return data;
    } catch (error) {
      console.error('Error handling save video:', error);
      if (window.showMessage) {
        window.showMessage('Failed to save video. Please try again.', 'error');
      }
      throw error;
    }
  }

  /**
   * Load the current save state for a video
   * @param {string} videoId - The video ID
   */
  async function loadSaveState(videoId) {
    try {
      const currentUser = window.currentUser;
      if (!currentUser || !currentUser.isLoggedIn) return;
      
      const response = await fetch(`${BASE_URL}/api/user/saved-videos/${videoId}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        updateSaveButtonUI(data.saved);
      }
    } catch (error) {
      console.warn('Error loading save state:', error);
    }
  }

  /**
   * Update the save button UI
   * @param {boolean} isSaved - Whether the video is saved
   */
  function updateSaveButtonUI(isSaved) {
    const saveButton = document.getElementById('save-button');
    if (!saveButton) return;
    
    const icon = saveButton.querySelector('i');
    const span = saveButton.querySelector('span');
    
    if (isSaved) {
      if (icon) icon.className = 'fas fa-bookmark';
      if (span) span.textContent = 'Saved';
      saveButton.classList.add('active');
    } else {
      if (icon) icon.className = 'far fa-bookmark';
      if (span) span.textContent = 'Save';
      saveButton.classList.remove('active');
    }
  }

  /**
   * Initialize share functionality for the video
   * @param {string} videoId - The ID of the video
   */
  async function initShare(videoId) {
    try {
      const shareButton = document.getElementById('share-button');
      if (!shareButton) return;
      
      // Add event listener for share button
      shareButton.addEventListener('click', () => handleShareVideo(videoId));
    } catch (error) {
      console.error('Error initializing share:', error);
    }
  }

  /**
   * Handle sharing a video
   * @param {string} videoId - The video ID
   */
  async function handleShareVideo(videoId) {
    try {
      const currentUrl = window.location.href;
      const videoTitle = document.getElementById('video-title')?.textContent || 'Check out this video';
      const videoDescription = document.getElementById('video-description')?.textContent || 'Watch this video on Replay Hub';
      
      // Get enhanced video data for sharing
      let shareData = {
        title: videoTitle,
        text: videoDescription.length > 100 ? videoDescription.substring(0, 97) + '...' : videoDescription,
        url: currentUrl
      };
      
      // Try to use the Web Share API if available
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      
      // Use social media meta module for enhanced clipboard functionality
      if (window.replayHub && window.replayHub.socialMediaMeta) {
        const success = await window.replayHub.socialMediaMeta.copyVideoLink();
        if (success) {
          if (window.showMessage) {
            window.showMessage('🎬 Video link copied to clipboard!', 'success');
          } else {
            alert('Video link copied to clipboard!');
          }
          return;
        }
      }
      
      // Fallback: Copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
        if (window.showMessage) {
          window.showMessage('Video link copied to clipboard!', 'success');
        } else {
          alert('Video link copied to clipboard!');
        }
      } else {
        // Final fallback: Show share modal with the URL
        showShareModal(currentUrl, videoTitle, videoDescription);
      }
    } catch (error) {
      console.error('Error sharing video:', error);
      if (error.name !== 'AbortError') { // User cancelled share
        if (window.showMessage) {
          window.showMessage('Failed to share video. Link copied to clipboard instead.', 'info');
        }
        // Try clipboard as fallback
        try {
          await navigator.clipboard.writeText(window.location.href);
        } catch (clipError) {
          console.error('Clipboard fallback failed:', clipError);
        }
      }
    }
  }

  /**
   * Show share modal with copy options
   * @param {string} url - The video URL
   * @param {string} title - The video title
   * @param {string} description - The video description
   */
  function showShareModal(url, title, description = '') {
    // Create enhanced share modal with social media previews
    const modal = document.createElement('div');
    modal.className = 'share-modal-overlay';
    
    // Prepare social sharing texts
    const shortDescription = description.length > 100 ? description.substring(0, 97) + '...' : description;
    const tweetText = `${title} - ${shortDescription}`.length > 200 
      ? `${title}` 
      : `${title} - ${shortDescription}`;
    const whatsappText = `${title}\n\n${shortDescription}\n\nWatch here:`;
    
    modal.innerHTML = `
      <div class="share-modal">
        <div class="share-modal-header">
          <h3><i class="fas fa-share"></i> Share Video</h3>
          <button class="share-modal-close">&times;</button>
        </div>
        <div class="share-modal-body">
          <div class="share-preview">
            <h4>${title}</h4>
            ${description ? `<p class="share-description">${shortDescription}</p>` : ''}
            <p class="share-note">📱 This video will show a rich preview with thumbnail when shared on Discord, WhatsApp, and other platforms!</p>
          </div>
          
          <div class="share-url-container">
            <label for="share-url">Video Link:</label>
            <div class="url-input-group">
              <input type="text" id="share-url" value="${url}" readonly class="share-url-input">
              <button class="copy-url-btn">
                <i class="fas fa-copy"></i> Copy
              </button>
            </div>
          </div>
          
          <div class="share-social">
            <h5>Share on Social Media:</h5>
            <div class="social-buttons">
              <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(url)}" target="_blank" class="share-btn twitter">
                <i class="fab fa-twitter"></i> Twitter
              </a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" class="share-btn facebook">
                <i class="fab fa-facebook"></i> Facebook
              </a>
              <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText + ' ' + url)}" target="_blank" class="share-btn whatsapp">
                <i class="fab fa-whatsapp"></i> WhatsApp
              </a>
              <a href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}" target="_blank" class="share-btn telegram">
                <i class="fab fa-telegram"></i> Telegram
              </a>
              <a href="https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}" target="_blank" class="share-btn reddit">
                <i class="fab fa-reddit"></i> Reddit
              </a>
              <a href="mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shortDescription + '\n\nWatch here: ' + url)}" target="_blank" class="share-btn email">
                <i class="fas fa-envelope"></i> Email
              </a>
            </div>
          </div>
          
          <div class="share-tips">
            <h5><i class="fas fa-lightbulb"></i> Sharing Tips:</h5>
            <ul>
              <li>🎬 The video will auto-preview in Discord, WhatsApp, and most messaging apps</li>
              <li>📱 Recipients can watch without creating an account</li>
              <li>🔗 This link works on all devices and browsers</li>
            </ul>
          </div>
        </div>
      </div>
    `;
    
    // Add enhanced styles
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    // Add styles for the modal content
    const style = document.createElement('style');
    style.textContent = `
      .share-modal {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }
      
      .share-modal-header {
        padding: 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .share-modal-header h3 {
        margin: 0;
        color: #333;
        font-size: 1.2em;
      }
      
      .share-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 5px;
      }
      
      .share-modal-close:hover {
        color: #000;
      }
      
      .share-modal-body {
        padding: 20px;
      }
      
      .share-preview {
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      
      .share-preview h4 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 1.1em;
      }
      
      .share-description {
        margin: 10px 0;
        color: #666;
        font-size: 0.9em;
        line-height: 1.4;
      }
      
      .share-note {
        margin: 10px 0 0 0;
        color: #28a745;
        font-size: 0.85em;
        font-weight: 500;
      }
      
      .share-url-container {
        margin-bottom: 20px;
      }
      
      .share-url-container label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
        color: #333;
      }
      
      .url-input-group {
        display: flex;
        gap: 10px;
      }
      
      .share-url-input {
        flex: 1;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-family: monospace;
        font-size: 0.9em;
        background: #f8f9fa;
      }
      
      .copy-url-btn {
        padding: 10px 15px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        white-space: nowrap;
      }
      
      .copy-url-btn:hover {
        background: #0056b3;
      }
      
      .share-social h5 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 1em;
      }
      
      .social-buttons {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
        margin-bottom: 20px;
      }
      
      .share-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px;
        border-radius: 8px;
        text-decoration: none;
        color: white;
        font-weight: 500;
        font-size: 0.9em;
        transition: all 0.2s;
      }
      
      .share-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      
      .share-btn.twitter { background: #1da1f2; }
      .share-btn.facebook { background: #1877f2; }
      .share-btn.whatsapp { background: #25d366; }
      .share-btn.telegram { background: #0088cc; }
      .share-btn.reddit { background: #ff4500; }
      .share-btn.email { background: #6c757d; }
      
      .share-tips {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid #28a745;
      }
      
      .share-tips h5 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 0.95em;
      }
      
      .share-tips ul {
        margin: 0;
        padding-left: 20px;
      }
      
      .share-tips li {
        margin-bottom: 5px;
        font-size: 0.85em;
        color: #666;
        line-height: 1.4;
      }
      
      @media (max-width: 600px) {
        .share-modal {
          width: 95%;
        }
        
        .social-buttons {
          grid-template-columns: 1fr;
        }
        
        .url-input-group {
          flex-direction: column;
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('.share-modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
    
    modal.querySelector('.copy-url-btn').addEventListener('click', async () => {
      const input = modal.querySelector('.share-url-input');
      input.select();
      try {
        await navigator.clipboard.writeText(url);
        modal.querySelector('.copy-url-btn').textContent = 'Copied!';
        setTimeout(() => {
          modal.querySelector('.copy-url-btn').textContent = 'Copy';
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        document.execCommand('copy');
        modal.querySelector('.copy-url-btn').textContent = 'Copied!';
        setTimeout(() => {
          modal.querySelector('.copy-url-btn').textContent = 'Copy';
        }, 2000);
      }
    });
  }

  /**
   * Check if current user is the video owner
   * @returns {boolean} - Whether current user owns the video
   */
  function isVideoOwner() {
    const currentUser = window.currentUser;
    const videoData = window.currentVideoData;
    
    if (!currentUser || !currentUser.isLoggedIn || !videoData) {
      return false;
    }
    
    // Check if current user is the uploader
    return videoData.uploader === currentUser.username || 
           videoData.uploader === currentUser.name ||
           videoData.user_id === currentUser.id;
  }

  /**
   * Delete a comment
   * @param {string} commentId - The ID of the comment to delete
   * @param {string} videoId - The ID of the video
   */
  async function deleteComment(commentId, videoId) {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`${BASE_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Remove the comment from the UI
      const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
      if (commentElement) {
        commentElement.remove();
      }
      
      // Update comments count
      updateCommentsCount(-1);
      
      showMessage('Comment deleted successfully!', 'success');
      
    } catch (error) {
      console.error('Error deleting comment:', error);
      showMessage('Failed to delete comment', 'error');
    }
  }

  /**
   * Delete a reply
   * @param {string} replyId - The ID of the reply to delete
   * @param {string} videoId - The ID of the video
   */
  async function deleteReply(replyId, videoId) {
    if (!confirm('Are you sure you want to delete this reply? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`${BASE_URL}/api/replies/${replyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Remove the reply from the UI
      const replyElement = document.querySelector(`[data-reply-id="${replyId}"]`);
      if (replyElement) {
        replyElement.remove();
      }
      
      showMessage('Reply deleted successfully!', 'success');
      
    } catch (error) {
      console.error('Error deleting reply:', error);
      showMessage('Failed to delete reply', 'error');
    }
  }

  /**
   * Update the comments count display
   * @param {number} delta - The change in count (positive or negative)
   */
  function updateCommentsCount(delta) {
    const commentsCountElement = document.getElementById('comments-count');
    if (!commentsCountElement) return;
    
    const currentText = commentsCountElement.textContent;
    const currentCount = parseInt(currentText.match(/\d+/)?.[0] || '0');
    const newCount = Math.max(0, currentCount + delta);
    
    commentsCountElement.textContent = `${newCount} Comment${newCount !== 1 ? 's' : ''}`;
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

  // Export functions
  window.replayHub.videoComments = {
    initComments,
    initReactions,
    initSaveBookmark,
    initShare
  };

  // VideoComments module ready
})();