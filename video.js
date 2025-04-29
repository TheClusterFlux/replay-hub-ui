// Video page specific functionality
function initVideoPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const s3Url = urlParams.get('s3_url');
    const videoId = urlParams.get('id');
    
    if (!s3Url) {
        showError('No video URL provided');
        return;
    }
    
    // Initialize video player
    initVideoPlayer(s3Url);
    
    // Fetch and display video metadata if we have an ID
    if (videoId) {
        fetchVideoDetails(videoId);
        initComments(videoId);
        initReactions(videoId);
    } else {
        // Extract some basic info from the URL if no ID provided
        const videoTitle = document.getElementById('video-title');
        if (videoTitle) {
            const filename = s3Url.split('/').pop().split('?')[0];
            videoTitle.textContent = decodeURIComponent(filename.replace(/\+/g, ' '));
        }
    }
}

/**
 * Fetch and display video metadata from the server
 * @param {string} videoId - The ID of the video to fetch details for
 */
async function fetchVideoDetails(videoId) {
    try {
        console.log(`Fetching video details for video ID: ${videoId}`);
        
        // Define the API endpoint using the BASE_URL from app.js
        const BASE_URL = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
        const response = await fetch(`${BASE_URL}/metadata/${videoId}`);
        
        if (!response.ok) {
            throw new Error(`Error fetching video details: ${response.status}`);
        }
        
        const videoData = await response.json();
        console.log('Video metadata received:', videoData);
        
        // Update the UI with the video details
        updateVideoUI(videoData);
        
    } catch (error) {
        console.error('Error fetching video details:', error);
        document.getElementById('video-description').textContent = 'Failed to load video details.';
    }
}

/**
 * Update the video UI with the fetched metadata
 * @param {object} videoData - The video metadata object
 */
function updateVideoUI(videoData) {
    // Update title
    const titleElement = document.getElementById('video-title');
    if (titleElement && videoData.title) {
        titleElement.textContent = videoData.title;
    }
    
    // Update views
    const viewsElement = document.getElementById('video-views');
    if (viewsElement && typeof videoData.views !== 'undefined') {
        viewsElement.textContent = `${formatViews(videoData.views)} views`;
    }
    
    // Update date
    const dateElement = document.getElementById('video-date');
    if (dateElement && videoData.upload_date) {
        dateElement.textContent = formatDate(new Date(videoData.upload_date));
    }
    
    // Update description
    const descriptionElement = document.getElementById('video-description');
    if (descriptionElement && videoData.description) {
        descriptionElement.textContent = videoData.description;
    }
    
    // Update like/dislike counts if those elements exist
    const likeButton = document.getElementById('like-button');
    if (likeButton && typeof videoData.likes !== 'undefined') {
        const likeSpan = likeButton.querySelector('span');
        if (likeSpan) {
            likeSpan.textContent = videoData.likes > 0 ? `${formatViews(videoData.likes)} Likes` : 'Like';
        }
    }
    
    const dislikeButton = document.getElementById('dislike-button');
    if (dislikeButton && typeof videoData.dislikes !== 'undefined') {
        const dislikeSpan = dislikeButton.querySelector('span');
        if (dislikeSpan) {
            dislikeSpan.textContent = videoData.dislikes > 0 ? `${formatViews(videoData.dislikes)} Dislikes` : 'Dislike';
        }
    }
    
    // Update page title
    if (videoData.title) {
        document.title = `${videoData.title} - Replay Hub`;
    }
    
    // Set video poster if thumbnail is available
    if (videoData.thumbnail_id) {
        const BASE_URL = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
        const thumbnailUrl = `${BASE_URL}/thumbnail/${videoData.thumbnail_id}`;
        
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
}

// Helper functions for formatting

/**
 * Format view counts (e.g., 1.2K, 3.4M)
 */
function formatViews(count) {
    if (typeof window.formatViews === 'function') {
        // Use the global formatViews function from app.js if available
        return window.formatViews(count);
    }
    
    // Local implementation as fallback
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Format date to a readable format
 */
function formatDate(date) {
    if (typeof window.formatDate === 'function') {
        // Use the global formatDate function from app.js if available
        return window.formatDate(date);
    }
    
    // Local implementation as fallback
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
}

/**
 * Initialize comments functionality for the video
 * @param {string} videoId - The ID of the video to fetch comments for
 */
async function initComments(videoId) {
    try {
        // Setup comment form
        const commentForm = document.getElementById('comment-form');
        const commentInput = document.getElementById('comment-input');
        const commentActions = document.getElementById('comment-actions');
        
        if (commentForm && commentInput) {
            // Show comment actions when input is focused
            commentInput.addEventListener('focus', () => {
                if (commentActions) commentActions.style.display = 'flex';
            });
            
            // Hide comment actions when cancel is clicked
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
        
        // Load initial comments
        await loadComments(videoId);
        
    } catch (error) {
        console.error('Error initializing comments:', error);
    }
}

/**
 * Load and display comments for a video
 * @param {string} videoId - The ID of the video to load comments for
 */
async function loadComments(videoId) {
    try {
        const commentsListElement = document.getElementById('comments-list');
        if (!commentsListElement) return;
        
        commentsListElement.innerHTML = '<div class="loading">Loading comments...</div>';
        
        // Define the API endpoint using the BASE_URL from app.js
        const BASE_URL = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
        const response = await fetch(`${BASE_URL}/comments/${videoId}`);
        
        if (!response.ok) {
            throw new Error(`Error fetching comments: ${response.status}`);
        }
        
        const comments = await response.json();
        console.log('Comments loaded:', comments);
        
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
 * @param {string} videoId - The ID of the video the comment belongs to
 * @returns {HTMLElement} - The comment element
 */
function createCommentElement(comment, videoId) {
    const commentContainer = document.createElement('div');
    commentContainer.className = 'comment';
    commentContainer.dataset.commentId = comment.id;
    
    // Create comment header
    const header = document.createElement('div');
    header.className = 'comment-header';
    
    // Create avatar
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = comment.username.charAt(0).toUpperCase();
    
    // Create comment metadata
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
    
    // Create comment body
    const body = document.createElement('div');
    body.className = 'comment-body';
    body.textContent = comment.text;
    
    // Create comment actions
    const actions = document.createElement('div');
    actions.className = 'comment-actions';
    
    const likeButton = document.createElement('button');
    likeButton.className = 'comment-action';
    likeButton.dataset.action = 'like';
    likeButton.innerHTML = `<i class="far fa-thumbs-up"></i> <span>${comment.likes || 0}</span>`;
    likeButton.addEventListener('click', () => handleCommentReaction(comment.id, videoId, 'like'));
    
    const dislikeButton = document.createElement('button');
    dislikeButton.className = 'comment-action';
    dislikeButton.dataset.action = 'dislike';
    dislikeButton.innerHTML = `<i class="far fa-thumbs-down"></i> <span>${comment.dislikes || 0}</span>`;
    dislikeButton.addEventListener('click', () => handleCommentReaction(comment.id, videoId, 'dislike'));
    
    const replyButton = document.createElement('button');
    replyButton.className = 'comment-action';
    replyButton.dataset.action = 'reply';
    replyButton.innerHTML = `<i class="fas fa-reply"></i> Reply`;
    replyButton.addEventListener('click', () => showReplyForm(comment.id, videoId));
    
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
    
    // Add container for reply form (hidden by default)
    const replyFormContainer = document.createElement('div');
    replyFormContainer.className = 'reply-form-container';
    replyFormContainer.style.display = 'none';
    replyFormContainer.dataset.commentId = comment.id;
    commentContainer.appendChild(replyFormContainer);
    
    return commentContainer;
}

/**
 * Create a DOM element for a reply
 * @param {Object} reply - The reply data
 * @param {string} parentId - The ID of the parent comment
 * @param {string} videoId - The ID of the video
 * @returns {HTMLElement} - The reply element
 */
function createReplyElement(reply, parentId, videoId) {
    const replyContainer = document.createElement('div');
    replyContainer.className = 'reply';
    replyContainer.dataset.replyId = reply.id;
    
    // Create reply header
    const header = document.createElement('div');
    header.className = 'reply-header';
    
    // Create avatar
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar small';
    avatar.textContent = reply.username.charAt(0).toUpperCase();
    
    // Create reply metadata
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
    
    // Create reply body
    const body = document.createElement('div');
    body.className = 'reply-body';
    body.textContent = reply.text;
    
    // Create reply actions
    const actions = document.createElement('div');
    actions.className = 'reply-actions';
    
    const likeButton = document.createElement('button');
    likeButton.className = 'reply-action';
    likeButton.dataset.action = 'like';
    likeButton.innerHTML = `<i class="far fa-thumbs-up"></i> <span>${reply.likes || 0}</span>`;
    likeButton.addEventListener('click', () => handleReplyReaction(reply.id, videoId, 'like'));
    
    const dislikeButton = document.createElement('button');
    dislikeButton.className = 'reply-action';
    dislikeButton.dataset.action = 'dislike';
    dislikeButton.innerHTML = `<i class="far fa-thumbs-down"></i> <span>${reply.dislikes || 0}</span>`;
    dislikeButton.addEventListener('click', () => handleReplyReaction(reply.id, videoId, 'dislike'));
    
    actions.appendChild(likeButton);
    actions.appendChild(dislikeButton);
    
    // Assemble reply
    replyContainer.appendChild(header);
    replyContainer.appendChild(body);
    replyContainer.appendChild(actions);
    
    return replyContainer;
}

/**
 * Show reply form for a comment
 * @param {string} commentId - The ID of the comment to reply to
 * @param {string} videoId - The ID of the video
 */
function showReplyForm(commentId, videoId) {
    // Find the reply form container
    const replyFormContainer = document.querySelector(`.reply-form-container[data-comment-id="${commentId}"]`);
    if (!replyFormContainer) return;
    
    // If the form is already open, just focus on it
    const existingForm = replyFormContainer.querySelector('form');
    if (existingForm) {
        replyFormContainer.style.display = 'block';
        existingForm.querySelector('input').focus();
        return;
    }
    
    // Create the reply form
    const form = document.createElement('form');
    form.className = 'reply-form';
    form.dataset.commentId = commentId;
    
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
    
    // Add submit handler
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
    
    // Add the form to the container and show it
    replyFormContainer.innerHTML = '';
    replyFormContainer.appendChild(form);
    replyFormContainer.style.display = 'block';
    
    // Focus on the input
    input.focus();
}

/**
 * Add a reply to a comment
 * @param {string} commentId - The ID of the comment to reply to
 * @param {string} videoId - The ID of the video
 * @param {string} text - The reply text
 */
async function addReply(commentId, videoId, text) {
    try {
        const BASE_URL = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
        const response = await fetch(`${BASE_URL}/comments/${commentId}/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
        
        const data = await response.json();
        console.log('Reply added:', data);
        return data;
    } catch (error) {
        console.error('Error adding reply:', error);
        throw error;
    }
}

/**
 * Handle reaction to a comment (like/dislike)
 */
async function handleCommentReaction(commentId, videoId, reactionType) {
    try {
        const BASE_URL = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
        const response = await fetch(`${BASE_URL}/comments/${commentId}/reactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
        console.log('Comment reaction processed:', data);
        
        // Update UI
        const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
        if (commentElement) {
            const likeButton = commentElement.querySelector('.comment-action[data-action="like"] span');
            const dislikeButton = commentElement.querySelector('.comment-action[data-action="dislike"] span');
            
            if (likeButton && data.currentLikes !== undefined) {
                likeButton.textContent = data.currentLikes;
            }
            
            if (dislikeButton && data.currentDislikes !== undefined) {
                dislikeButton.textContent = data.currentDislikes;
            }
        }
        
        return data;
    } catch (error) {
        console.error('Error handling comment reaction:', error);
        throw error;
    }
}

/**
 * Handle reaction to a reply (like/dislike)
 */
async function handleReplyReaction(replyId, videoId, reactionType) {
    try {
        const BASE_URL = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
        const response = await fetch(`${BASE_URL}/comments/${replyId}/reactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
        console.log('Reply reaction processed:', data);
        
        // Update UI
        const replyElement = document.querySelector(`.reply[data-reply-id="${replyId}"]`);
        if (replyElement) {
            const likeButton = replyElement.querySelector('.reply-action[data-action="like"] span');
            const dislikeButton = replyElement.querySelector('.reply-action[data-action="dislike"] span');
            
            if (likeButton && data.currentLikes !== undefined) {
                likeButton.textContent = data.currentLikes;
            }
            
            if (dislikeButton && data.currentDislikes !== undefined) {
                dislikeButton.textContent = data.currentDislikes;
            }
        }
        
        return data;
    } catch (error) {
        console.error('Error handling reply reaction:', error);
        throw error;
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
        likeButton.addEventListener('click', () => {
            handleVideoReaction(videoId, 'like');
        });
        
        dislikeButton.addEventListener('click', () => {
            handleVideoReaction(videoId, 'dislike');
        });
        
        // Initially load reaction state for current user (if implementable)
        // This would require tracking which videos the user has liked/disliked
    } catch (error) {
        console.error('Error initializing reactions:', error);
    }
}

/**
 * Handle reaction to a video (like/dislike)
 */
async function handleVideoReaction(videoId, reactionType) {
    try {
        // Define the API endpoint using the BASE_URL from app.js
        const BASE_URL = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
        const response = await fetch(`${BASE_URL}/reactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
        console.log('Video reaction processed:', data);
        
        // Update the UI
        const likeButton = document.getElementById('like-button');
        const dislikeButton = document.getElementById('dislike-button');
        
        if (likeButton && data.currentLikes !== undefined) {
            const likeSpan = likeButton.querySelector('span');
            if (likeSpan) {
                likeSpan.textContent = data.currentLikes > 0 ? `${formatViews(data.currentLikes)} Likes` : 'Like';
            }
            
            // Update classes based on whether this is the active reaction
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
                dislikeSpan.textContent = data.currentDislikes > 0 ? `${formatViews(data.currentDislikes)} Dislikes` : 'Dislike';
            }
            
            // Update classes based on whether this is the active reaction
            if (reactionType === 'dislike') {
                dislikeButton.classList.add('active');
                likeButton.classList.remove('active');
            } else if (reactionType === 'like') {
                dislikeButton.classList.remove('active');
            }
        }
        
        return data;
    } catch (error) {
        console.error('Error handling video reaction:', error);
        throw error;
    }
}

// Function to add a comment to a video
async function addComment(videoId, text) {
    try {
        const BASE_URL = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
        const response = await fetch(`${BASE_URL}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
        
        const data = await response.json();
        console.log('Comment added:', data);
        return data;
    } catch (error) {
        console.error('Error adding comment:', error);
        throw error;
    }
}

// Initialize the page once DOM is loaded
document.addEventListener('DOMContentLoaded', initVideoPage);