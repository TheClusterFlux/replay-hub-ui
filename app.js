// Constants
const ISLOCAL = false;
const BASE_URL = ISLOCAL ? 'http://localhost:8080' : 'https://replay-hub.theclusterflux.com';

// Global state
let allVideos = []; 
let currentUser = {
    id: 'guest-user',
    name: 'Guest User',
    avatar: null
};

// Utility functions
function formatDate(date) {
    const now = new Date();
    const diff = now - date;

    // If less than a day, show hours ago
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return hours <= 0 ? 'Just now' : `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    
    // If less than a week, show days ago
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // Otherwise show date
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    let result = '';
    
    if (hrs > 0) {
        result += `${hrs}:${mins < 10 ? '0' : ''}`;
    }
    
    result += `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    
    return result;
}

function formatViews(count) {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// API functions
async function fetchVideos() {
    try {
        const response = await fetch(`${BASE_URL}/metadata`);
        if (!response.ok) {
            throw new Error(`Failed to fetch videos: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching videos:', error);
        return [];
    }
}

async function fetchVideo(videoId) {
    try {
        const response = await fetch(`${BASE_URL}/metadata/${videoId}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching video ${videoId}:`, error);
        return null;
    }
}

// Add function to update video view count
async function updateVideoView(videoId) {
    try {
        const response = await fetch(`${BASE_URL}/metadata/${videoId}/view`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id
            })
        });
        return await response.json();
    } catch (error) {
        console.error(`Error updating view count for video ${videoId}:`, error);
        return null;
    }
}

async function fetchComments(videoId) {
    try {
        const response = await fetch(`${BASE_URL}/comments/${videoId}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching comments for video ${videoId}:`, error);
        return [];
    }
}

async function addComment(videoId, text) {
    try {
        const response = await fetch(`${BASE_URL}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoId,
                userId: currentUser.id,
                username: currentUser.name,
                text,
                timestamp: new Date().toISOString()
            })
        });
        return await response.json();
    } catch (error) {
        console.error(`Error adding comment to video ${videoId}:`, error);
        return null;
    }
}

async function addReaction(videoId, reactionType) {
    try {
        const response = await fetch(`${BASE_URL}/reactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoId,
                userId: currentUser.id,
                type: reactionType,
                timestamp: new Date().toISOString()
            })
        });
        return await response.json();
    } catch (error) {
        console.error(`Error adding reaction to video ${videoId}:`, error);
        return null;
    }
}

async function uploadVideo(formData, progressCallback) {
    return new Promise((resolve, reject) => {
        const file = formData.get('file');
        
        // If file is larger than 100MB, use chunked upload
        if (file && file.size > 100 * 1024 * 1024) {
            console.log('Large file detected, using chunked upload');
            return uploadLargeFile(formData, progressCallback)
                .then(resolve)
                .catch(reject);
        }
        
        // For smaller files, use traditional upload
        const xhr = new XMLHttpRequest();
        
        xhr.open('POST', `${BASE_URL}/upload`, true);
        
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && progressCallback) {
                const progress = (event.loaded / event.total) * 100;
                progressCallback(progress);
            }
        };
        
        xhr.onload = function() {
            if (xhr.status === 201) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (e) {
                    reject(new Error('Invalid response format'));
                }
            } else if (xhr.status === 413) {
                // Handle Request Entity Too Large error
                reject(new Error('File is too large for the server to process. Please try using a smaller file.'));
            } else {
                reject(new Error(`Upload failed with status: ${xhr.status}`));
            }
        };
        
        xhr.onerror = function() {
            reject(new Error('Network error during upload'));
        };
        
        xhr.send(formData);
    });
}

// Function to handle large file uploads via chunking
async function uploadLargeFile(formData, progressCallback) {
    const file = formData.get('file');
    const title = formData.get('title');
    const description = formData.get('description');
    
    if (!file) {
        throw new Error('No file found in form data');
    }
    
    // Configuration for chunked upload
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    let uploadedChunks = 0;
    let totalUploaded = 0;
    
    console.log(`Preparing chunked upload: ${totalChunks} chunks of ${chunkSize} bytes`);
    
    // Start metadata upload first to get the file ID
    const metadataForm = new FormData();
    metadataForm.append('title', title);
    metadataForm.append('description', description);
    metadataForm.append('s3', 'true');
    metadataForm.append('chunked', 'true');
    metadataForm.append('totalChunks', totalChunks.toString());
    metadataForm.append('fileSize', file.size.toString());
    metadataForm.append('filename', file.name);
    
    try {
        // We would normally send this to a metadata/initialization endpoint that returns a fileId
        // For now, we'll just generate a unique ID for demonstration purposes
        const fileId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        // Process each chunk
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            // Create a form for this chunk
            const chunkForm = new FormData();
            chunkForm.append('file', chunk, `${file.name}.part${chunkIndex}`);
            chunkForm.append('s3', 'true');
            chunkForm.append('fileId', fileId);
            chunkForm.append('chunkIndex', chunkIndex.toString());
            chunkForm.append('totalChunks', totalChunks.toString());
            
            // Upload this chunk
            try {
                // In a real implementation, we'd point this to a chunk upload endpoint
                // For now, we're using the standard upload endpoint
                const xhr = new XMLHttpRequest();
                
                await new Promise((resolveChunk, rejectChunk) => {
                    xhr.open('POST', `${BASE_URL}/upload`, true);
                    
                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                            // Calculate overall progress across all chunks
                            const chunkProgress = (event.loaded / event.total) * (chunkSize / file.size);
                            const overallProgress = ((chunkIndex / totalChunks) + chunkProgress) * 100;
                            
                            if (progressCallback) {
                                progressCallback(Math.min(overallProgress, 99)); // Cap at 99% until fully complete
                            }
                        }
                    };
                    
                    xhr.onload = function() {
                        if (xhr.status === 201) {
                            uploadedChunks++;
                            totalUploaded += chunk.size;
                            
                            console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`);
                            resolveChunk();
                        } else {
                            rejectChunk(new Error(`Chunk upload failed with status: ${xhr.status}`));
                        }
                    };
                    
                    xhr.onerror = function() {
                        rejectChunk(new Error('Network error during chunk upload'));
                    };
                    
                    xhr.send(chunkForm);
                });
                
            } catch (chunkError) {
                console.error(`Error uploading chunk ${chunkIndex}:`, chunkError);
                
                // Retry logic could be added here
                throw new Error(`Failed to upload chunk ${chunkIndex}: ${chunkError.message}`);
            }
        }
        
        // When all chunks are uploaded, inform the server to combine them
        // This would typically be a separate API call to a finalization endpoint
        console.log('All chunks uploaded successfully, finalizing...');
        
        if (progressCallback) {
            progressCallback(100);
        }
        
        // Simulate the final response
        // In a real application, you would make a call to finalize the upload
        return {
            success: true,
            metadata: {
                id: fileId,
                title,
                description,
                s3_url: `https://example.com/${fileId}/${file.name}`,
                // Other metadata would be included from the server response
            }
        };
        
    } catch (error) {
        console.error('Error during chunked upload:', error);
        throw error;
    }
}

// DOM utility functions
function createVideoCard(video) {
    // Ensure video object is valid
    if (!video) {
        console.warn('Attempted to create video card with null or undefined video');
        return null;
    }

    // Ensure video has essential properties
    const validS3Url = video.s3_url && typeof video.s3_url === 'string';
    
    // Create the base card element
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.videoId = video.id || '';
    card.dataset.s3Url = video.s3_url || '';
    
    // Create the thumbnail container
    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'thumbnail-container';
    
    // Create the thumbnail image
    const thumbnail = document.createElement('img');
    thumbnail.className = 'thumbnail';
    thumbnail.src = video.thumbnail_id ? `${BASE_URL}/thumbnail/${video.thumbnail_id}` : 'assets/placeholder.jpg';
    thumbnail.alt = `${video.title || 'Video'} Thumbnail`;
    
    // Create the duration badge
    const duration = document.createElement('span');
    duration.className = 'video-duration';
    duration.textContent = formatDuration(video.duration || 0);
    
    // Add them to the thumbnail container
    thumbnailContainer.appendChild(thumbnail);
    thumbnailContainer.appendChild(duration);
    
    // Create video info section
    const videoInfo = document.createElement('div');
    videoInfo.className = 'video-info';
    
    // Create video title
    const title = document.createElement('h3');
    title.className = 'video-title';
    title.textContent = video.title || 'Untitled Video';
    
    // Create uploader/channel name
    const channel = document.createElement('div');
    channel.className = 'video-channel';
    channel.textContent = video.uploader || 'Unknown';
    
    // Create video stats
    const stats = document.createElement('div');
    stats.className = 'video-stats';
    stats.textContent = `${formatViews(video.views || 0)} views • ${formatDate(new Date(video.upload_date || new Date()))}`;
    
    // Create players list if available
    if (video.players && video.players.length > 0) {
        const playersInfo = document.createElement('div');
        playersInfo.className = 'video-players';
        playersInfo.textContent = `Players: ${video.players.join(', ')}`;
        videoInfo.appendChild(playersInfo);
    }
    
    // Add elements to video info
    videoInfo.appendChild(title);
    videoInfo.appendChild(channel);
    videoInfo.appendChild(stats);
    
    // Add all components to the card
    card.appendChild(thumbnailContainer);
    card.appendChild(videoInfo);
    
    // Add click event to navigate to the video page
    card.addEventListener('click', () => {
        if (validS3Url) {
            window.location.href = `video.html?s3_url=${encodeURIComponent(video.s3_url)}&id=${video.id || ''}`;
        } else {
            console.error('Cannot navigate to video: Missing or invalid s3_url');
            alert('Sorry, this video is currently unavailable.');
        }
    });
    
    return card;
}

// Initialize the page based on current URL
function initPage() {
    const path = window.location.pathname;
    
    if (path.endsWith('index.html') || path === '/' || path === '') {
        initHomePage();
    } else if (path.endsWith('video.html')) {
        initVideoPage();
    }
    
    // Add event listeners for the upload modal
    initUploadModal();
}

// Initialize the homepage
async function initHomePage() {
    const videoGrid = document.getElementById('video-grid');
    if (!videoGrid) return;
    
    // Show loading state
    videoGrid.innerHTML = '<div class="loading">Loading videos...</div>';
    
    // Fetch videos
    allVideos = await fetchVideos();
    
    // Clear and render videos
    videoGrid.innerHTML = '';
    if (allVideos.length === 0) {
        videoGrid.innerHTML = '<div class="no-videos">No videos available</div>';
        return;
    }
    
    // Filter out videos without valid s3_url
    const validVideos = allVideos.filter(video => video && video.s3_url);
    
    if (validVideos.length === 0) {
        videoGrid.innerHTML = '<div class="no-videos">No videos available</div>';
        return;
    }
    
    validVideos.forEach(video => {
        const card = createVideoCard(video);
        if (card) {
            videoGrid.appendChild(card);
        }
    });
    
    // Add search functionality
    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        searchBar.addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase();
            filterVideos(searchTerm);
        });
    }
}

// Filter videos based on search term
function filterVideos(searchTerm) {
    const videoGrid = document.getElementById('video-grid');
    if (!videoGrid) return;
    
    videoGrid.innerHTML = '';
    
    // Filter videos with valid s3_url first, then apply search filter
    const validVideos = allVideos.filter(video => video && video.s3_url);
    
    const filteredVideos = searchTerm 
        ? validVideos.filter(video => {
            return Object.values(video).some(value =>
                String(value).toLowerCase().includes(searchTerm)
            );
        })
        : validVideos;
    
    if (filteredVideos.length === 0) {
        videoGrid.innerHTML = '<div class="no-videos">No videos found</div>';
        return;
    }
    
    filteredVideos.forEach(video => {
        const card = createVideoCard(video);
        if (card) {
            videoGrid.appendChild(card);
        }
    });
}

// Function to initialize the video page
function initVideoPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const s3Url = urlParams.get('s3_url');
    const videoId = urlParams.get('id');
    
    if (!s3Url) {
        console.error('Missing s3_url parameter');
        alert('Error: Video URL not provided.');
        return;
    }
    
    // Update the video view count when the page is loaded
    if (videoId) {
        updateVideoView(videoId)
            .then(response => {
                console.log('View count updated:', response);
                // Update the view count in the UI if needed
                const viewCountElement = document.getElementById('view-count');
                if (viewCountElement && response && response.views) {
                    viewCountElement.textContent = formatViews(response.views);
                }
            })
            .catch(error => {
                console.error('Error updating view count:', error);
            });
    }
    
    // Initialize video player, metadata, etc.
    // This function would contain code specific to the video page
    console.log('Video page initialized for:', s3Url, 'ID:', videoId);
}

// Wait for DOM to be loaded before initializing
document.addEventListener('DOMContentLoaded', initPage);

// Initialize the upload modal
function initUploadModal() {
    const uploadButton = document.getElementById('upload-button');
    const modalOverlay = document.getElementById('modal-overlay');
    const closeModal = document.getElementById('close-modal');
    const singleUploadTab = document.getElementById('single-upload-tab');
    const bulkUploadTab = document.getElementById('bulk-upload-tab');
    const singleUploadContent = document.getElementById('single-upload');
    const bulkUploadContent = document.getElementById('bulk-upload');
    const uploadForm = document.getElementById('upload-form');
    const bulkUploadForm = document.getElementById('bulk-upload-form');
    const singleDropzone = document.getElementById('single-dropzone');
    const bulkDropzone = document.getElementById('bulk-dropzone');
    const progressContainer = document.getElementById('progress-container');
    const uploadProgress = document.getElementById('upload-progress');
    const uploadStatus = document.getElementById('upload-status');
    const uploadList = document.getElementById('upload-list');
    
    // Define max file size (10GB in bytes) to match server limit
    const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;
    
    console.log('Initializing upload modal');
    console.log('Upload button exists:', !!uploadButton);
    console.log('Modal overlay exists:', !!modalOverlay);
    
    // Selected file for single upload
    let selectedFile = null;
    
    // Array of files for bulk upload
    let selectedBulkFiles = [];
    
    // Open modal when upload button is clicked
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            console.log('Upload button clicked');
            if (modalOverlay) {
                // Use the active class instead of display style
                modalOverlay.classList.add('active');
                console.log('Modal displayed');
            }
        });
    }
    
    // Close modal when X is clicked
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            console.log('Close button clicked');
            if (modalOverlay) modalOverlay.classList.remove('active');
            resetUploadForm();
        });
    }
    
    // Close modal when clicking outside the modal
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (event) => {
            if (event.target === modalOverlay) {
                modalOverlay.classList.remove('active');
                resetUploadForm();
            }
        });
    }
    
    // Tab switching functionality
    if (singleUploadTab && bulkUploadTab) {
        singleUploadTab.addEventListener('click', () => {
            singleUploadTab.classList.add('active');
            bulkUploadTab.classList.remove('active');
            if (singleUploadContent) singleUploadContent.classList.add('active');
            if (bulkUploadContent) bulkUploadContent.classList.remove('active');
        });
        
        bulkUploadTab.addEventListener('click', () => {
            bulkUploadTab.classList.add('active');
            singleUploadTab.classList.remove('active');
            if (bulkUploadContent) bulkUploadContent.classList.add('active');
            if (singleUploadContent) singleUploadContent.classList.remove('active');
        });
    }
    
    // Handling file selection for single upload
    if (singleDropzone) {
        // Prevent default browser behavior for drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            singleDropzone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Visual feedback for drag events
        ['dragenter', 'dragover'].forEach(eventName => {
            singleDropzone.addEventListener(eventName, () => {
                singleDropzone.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            singleDropzone.addEventListener(eventName, () => {
                singleDropzone.classList.remove('dragover');
            }, false);
        });
        
        // Handle dropped files
        singleDropzone.addEventListener('drop', (event) => {
            if (event.dataTransfer.files.length > 0) {
                const file = event.dataTransfer.files[0];
                // Validate file size before accepting
                if (file.size > MAX_FILE_SIZE) {
                    alert(`File is too large. Maximum allowed size is 10GB. Your file is ${formatFileSize(file.size)}.`);
                    return;
                }
                selectedFile = file;
                updateSingleDropzoneUI(selectedFile);
            }
        }, false);
        
        // File click selection for single upload
        singleDropzone.addEventListener('click', () => {
            console.log('Dropzone clicked');
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'video/*';
            
            fileInput.addEventListener('change', (event) => {
                if (event.target.files.length > 0) {
                    const file = event.target.files[0];
                    // Validate file size before accepting
                    if (file.size > MAX_FILE_SIZE) {
                        alert(`File is too large. Maximum allowed size is 10GB. Your file is ${formatFileSize(file.size)}.`);
                        return;
                    }
                    selectedFile = file;
                    console.log('File selected:', selectedFile.name, 'Size:', formatFileSize(selectedFile.size));
                    updateSingleDropzoneUI(selectedFile);
                }
            });
            
            fileInput.click();
        });
    }
    
    // Handling file selection for bulk upload
    if (bulkDropzone) {
        // Prevent default browser behavior for drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            bulkDropzone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Visual feedback for drag events
        ['dragenter', 'dragover'].forEach(eventName => {
            bulkDropzone.addEventListener(eventName, () => {
                bulkDropzone.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            bulkDropzone.addEventListener(eventName, () => {
                bulkDropzone.classList.remove('dragover');
            }, false);
        });
        
        // Handle dropped files for bulk upload
        bulkDropzone.addEventListener('drop', (event) => {
            const files = event.dataTransfer.files;
            handleBulkFileSelection(files);
        }, false);
        
        // File click selection for bulk upload
        bulkDropzone.addEventListener('click', () => {
            console.log('Bulk dropzone clicked');
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'video/*';
            fileInput.multiple = true;
            
            fileInput.addEventListener('change', (event) => {
                handleBulkFileSelection(event.target.files);
            });
            
            fileInput.click();
        });
        
        // Process multiple selected files for bulk upload
        function handleBulkFileSelection(files) {
            if (!files || files.length === 0) return;
            
            // Filter files by size and add to the bulk files array
            const validFiles = Array.from(files).filter(file => {
                if (file.size > MAX_FILE_SIZE) {
                    console.warn(`File "${file.name}" exceeds maximum size limit of 10GB`);
                    return false;
                }
                return true;
            });
            
            // Warn user if some files were skipped due to size
            if (validFiles.length < files.length) {
                alert(`${files.length - validFiles.length} file(s) exceeded the 10GB size limit and were not added.`);
            }
            
            // Add valid files to our collection
            selectedBulkFiles = [...selectedBulkFiles, ...validFiles];
            
            // Update the UI to show selected files
            updateBulkDropzoneUI();
        }
        
        // Update UI with selected bulk files
        function updateBulkDropzoneUI() {
            if (!uploadList) return;
            
            // Show the upload list if we have files
            if (selectedBulkFiles.length > 0) {
                uploadList.style.display = 'block';
                uploadList.innerHTML = '';
                
                // Add each file to the list
                selectedBulkFiles.forEach((file, index) => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'upload-item';
                    fileItem.innerHTML = `
                        <div class="file-info">
                            <i class="fas fa-file-video"></i>
                            <p>${file.name}</p>
                            <p class="file-size">${formatFileSize(file.size)}</p>
                        </div>
                        <button type="button" class="remove-file" data-index="${index}">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    uploadList.appendChild(fileItem);
                });
                
                // Add event listeners to remove buttons
                document.querySelectorAll('.remove-file').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const index = parseInt(e.currentTarget.getAttribute('data-index'));
                        selectedBulkFiles.splice(index, 1);
                        updateBulkDropzoneUI();
                    });
                });
            } else {
                // Hide the list if no files
                uploadList.style.display = 'none';
                uploadList.innerHTML = '';
            }
        }
    }
    
    // Handling form submission for single upload
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Form submitted');
            
            const titleInput = document.getElementById('video-title');
            const descriptionInput = document.getElementById('video-description');
            const uploaderInput = document.getElementById('video-uploader');
            const playersInput = document.getElementById('video-players');
            
            if (!selectedFile) {
                alert('Please select a video file to upload');
                return;
            }
            
            // Double-check file size before uploading
            if (selectedFile.size > MAX_FILE_SIZE) {
                alert(`File is too large. Maximum allowed size is 10GB. Your file is ${formatFileSize(selectedFile.size)}.`);
                return;
            }
            
            if (!titleInput.value.trim()) {
                alert('Please enter a title for the video');
                titleInput.focus();
                return;
            }
            
            if (!descriptionInput.value.trim()) {
                alert('Please enter a description for the video');
                descriptionInput.focus();
                return;
            }
            
            if (!uploaderInput.value.trim()) {
                alert('Please enter a username for the video');
                uploaderInput.focus();
                return;
            }
            
            // Show progress bar
            if (progressContainer) progressContainer.style.display = 'block';
            if (uploadStatus) uploadStatus.textContent = 'Preparing to upload...';
            
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('title', titleInput.value.trim());
            formData.append('description', descriptionInput.value.trim());
            formData.append('uploader', uploaderInput.value.trim());
            formData.append('s3', 'true'); // Always upload to S3
            
            // Add players if available
            if (playersInput && playersInput.value.trim()) {
                const players = playersInput.value.split(',').map(player => player.trim());
                formData.append('players', JSON.stringify(players));
            }
            
            console.log('FormData created:', {
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
                title: titleInput.value.trim(),
                description: descriptionInput.value.trim(),
                uploader: uploaderInput.value.trim(),
                players: playersInput ? playersInput.value : ''
            });
            
            try {
                console.log('Starting upload...');
                const response = await uploadVideo(formData, (progress) => {
                    if (uploadProgress) uploadProgress.style.width = `${progress}%`;
                    if (uploadStatus) uploadStatus.textContent = `Uploading... ${Math.round(progress)}%`;
                });
                
                console.log('Upload successful:', response);
                
                if (uploadStatus) uploadStatus.textContent = 'Upload complete!';
                
                // Reload videos after successful upload
                setTimeout(() => {
                    if (modalOverlay) modalOverlay.classList.remove('active');
                    resetUploadForm();
                    
                    // Refresh the video grid if we're on the homepage
                    if (window.location.pathname.endsWith('index.html') || 
                        window.location.pathname === '/' || 
                        window.location.pathname === '') {
                        initHomePage();
                    }
                }, 1500);
                
            } catch (error) {
                console.error('Error uploading video:', error);
                if (uploadStatus) uploadStatus.textContent = `Error: ${error.message}`;
            }
        });
    }
    
    // Handling form submission for bulk upload
    if (bulkUploadForm) {
        bulkUploadForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Bulk upload form submitted');
            
            const uploaderInput = document.getElementById('bulk-video-uploader');
            
            if (!selectedBulkFiles || selectedBulkFiles.length === 0) {
                alert('Please select at least one video file to upload');
                return;
            }
            
            if (!uploaderInput || !uploaderInput.value.trim()) {
                alert('Please enter an uploader name for the videos');
                uploaderInput.focus();
                return;
            }
            
            // Show progress message
            if (bulkDropzone) {
                bulkDropzone.innerHTML = `<p class="dropzone-text">Uploading ${selectedBulkFiles.length} files. Please wait...</p>`;
            }
            
            // Process each file in sequence
            let successCount = 0;
            
            for (let i = 0; i < selectedBulkFiles.length; i++) {
                const file = selectedBulkFiles[i];
                
                // Update upload list to show current file progress
                if (uploadList) {
                    const items = uploadList.querySelectorAll('.upload-item');
                    if (items[i]) {
                        items[i].classList.add('uploading');
                        items[i].innerHTML += `
                            <div class="file-progress">
                                <div class="progress-bar">
                                    <div class="progress" style="width: 0%"></div>
                                </div>
                                <div class="progress-text">Preparing...</div>
                            </div>
                        `;
                    }
                }
                
                // Basic file metadata
                const fileName = file.name.split('.')[0] || `Video ${i+1}`;
                
                // Create form data for this file
                const formData = new FormData();
                formData.append('file', file);
                formData.append('title', fileName);
                formData.append('description', `Uploaded on ${new Date().toLocaleDateString()}`);
                formData.append('uploader', uploaderInput.value.trim());
                formData.append('s3', 'true');
                
                try {
                    // Upload the file
                    const response = await uploadVideo(formData, (progress) => {
                        // Update progress in the list item
                        if (uploadList) {
                            const progressBar = uploadList.querySelectorAll('.upload-item .progress')[i];
                            const progressText = uploadList.querySelectorAll('.upload-item .progress-text')[i];
                            
                            if (progressBar) progressBar.style.width = `${progress}%`;
                            if (progressText) progressText.textContent = `${Math.round(progress)}%`;
                        }
                    });
                    
                    // Mark as complete in the list
                    if (uploadList) {
                        const items = uploadList.querySelectorAll('.upload-item');
                        if (items[i]) {
                            items[i].classList.remove('uploading');
                            items[i].classList.add('uploaded');
                            const progressText = items[i].querySelector('.progress-text');
                            if (progressText) progressText.textContent = 'Uploaded!';
                        }
                    }
                    
                    successCount++;
                    
                } catch (error) {
                    console.error(`Error uploading file ${file.name}:`, error);
                    
                    // Mark as failed in the list
                    if (uploadList) {
                        const items = uploadList.querySelectorAll('.upload-item');
                        if (items[i]) {
                            items[i].classList.remove('uploading');
                            items[i].classList.add('upload-failed');
                            const progressText = items[i].querySelector('.progress-text');
                            if (progressText) progressText.textContent = `Failed: ${error.message}`;
                        }
                    }
                }
            }
            
            // Update dropzone with completion message
            if (bulkDropzone) {
                bulkDropzone.innerHTML = `
                    <p class="dropzone-text">Uploads complete!</p>
                    <p class="dropzone-subtext">${successCount} of ${selectedBulkFiles.length} files uploaded successfully.</p>
                `;
            }
            
            // Reload videos after successful upload
            setTimeout(() => {
                // Only close and reset if all uploads were successful
                if (successCount === selectedBulkFiles.length) {
                    if (modalOverlay) modalOverlay.classList.remove('active');
                    resetUploadForm();
                }
                
                // Refresh the video grid if we're on the homepage
                if (window.location.pathname.endsWith('index.html') || 
                    window.location.pathname === '/' || 
                    window.location.pathname === '') {
                    initHomePage();
                }
            }, 2000);
        });
    }
    
    // Helper function to update the UI after file selection
    function updateSingleDropzoneUI(file) {
        if (!singleDropzone) return;
        
        singleDropzone.innerHTML = `
            <div class="selected-file">
                <i class="fas fa-file-video"></i>
                <p>${file.name}</p>
                <p class="file-size">${formatFileSize(file.size)}</p>
            </div>
        `;
    }
    
    // Helper function to format file size
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(1) + ' GB';
    }
    
    // Helper function to reset the form after upload
    function resetUploadForm() {
        selectedFile = null;
        selectedBulkFiles = [];
        
        if (uploadForm) uploadForm.reset();
        if (bulkUploadForm) bulkUploadForm.reset();
        
        if (singleDropzone) {
            singleDropzone.innerHTML = `
                <div class="dropzone-icon">
                    <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <p class="dropzone-text">Drag and drop a video here or click to select</p>
                <p class="dropzone-subtext">MP4, WebM, MOV or AVI. Max 10GB.</p>
            `;
        }
        
        if (bulkDropzone) {
            bulkDropzone.innerHTML = `
                <div class="dropzone-icon">
                    <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <p class="dropzone-text">Drag and drop multiple videos here or click to select</p>
                <p class="dropzone-subtext">MP4, WebM, MOV or AVI. Max 10GB per file.</p>
            `;
        }
        
        if (uploadList) {
            uploadList.style.display = 'none';
            uploadList.innerHTML = '';
        }
        
        if (progressContainer) progressContainer.style.display = 'none';
        if (uploadProgress) uploadProgress.style.width = '0%';
    }
}