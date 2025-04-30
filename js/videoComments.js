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
   */
  async function initComments(videoId) {
    try {
      // Set up the comment form
      setupCommentForm(videoId);
      
      // Load initial comments
      await loadComments(videoId);
    } catch (error) {
      console.error('Error initializing comments:', error);
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
    button.dataset.action = action;
    
    if (action === 'like') {
      button.innerHTML = `<i class="far fa-thumbs-up"></i> <span>${text}</span>`;
    } else if (action === 'dislike') {
      button.innerHTML = `<i class="far fa-thumbs-down"></i> <span>${text}</span>`;
    } else if (action === 'reply') {
      button.innerHTML = `<i class="fas fa-reply"></i> ${text}`;
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
   */
  async function addComment(videoId, text) {
    try {
      const response = await fetch(`${BASE_URL}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: window.currentUser?.id || 'guest-user',
          username: window.currentUser?.name || 'Guest User',
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
   */
  async function addReply(commentId, videoId, text) {
    try {
      const response = await fetch(`${BASE_URL}/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: window.currentUser?.id || 'guest-user',
          username: window.currentUser?.name || 'Guest User',
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
   */
  async function handleCommentReaction(commentId, videoId, reactionType) {
    try {
      const response = await fetch(`${BASE_URL}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: window.currentUser?.id || 'guest-user',
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
   */
  async function handleReplyReaction(replyId, videoId, reactionType) {
    try {
      const response = await fetch(`${BASE_URL}/comments/${replyId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: window.currentUser?.id || 'guest-user',
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
   */
  async function handleVideoReaction(videoId, reactionType) {
    try {
      const response = await fetch(`${BASE_URL}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          userId: window.currentUser?.id || 'guest-user',
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

  // Export functions
  window.replayHub.videoComments = {
    initComments,
    initReactions
  };

  // Signal that this module is ready
  console.log('VideoComments module initialized');
})();