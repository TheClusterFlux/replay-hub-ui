// Constants
const ISLOCAL = false;
export const BASE_URL = ISLOCAL ? 'http://localhost:8080' : 'https://replay-hub.theclusterflux.com';

// Make BASE_URL available globally for non-module scripts
window.BASE_URL = BASE_URL;

// Initialize current user state
let currentUser = {
    id: null,
    name: 'Guest User',
    username: null,
    email: null,
    avatar: null,
    isLoggedIn: false
};

// Make current user available globally
window.currentUser = currentUser;

// Auth-related functions
async function initializeAuth() {
    try {
        // Initialize the auth module
        if (window.replayHub && window.replayHub.auth) {
            const isAuthenticated = await window.replayHub.auth.initAuth();
            updateLoginStatus(isAuthenticated);
            return isAuthenticated;
        } else {
            console.warn('Auth module not loaded yet, will retry...');
            // Retry after a short delay
            setTimeout(initializeAuth, 100);
            return false;
        }
    } catch (error) {
        console.error('Failed to initialize authentication:', error);
        updateLoginStatus(false);
        return false;
    }
}

// Login function for UI
async function loginUser(username, password) {
    try {
        if (!window.replayHub || !window.replayHub.auth) {
            throw new Error('Authentication module not loaded');
        }
        
        const result = await window.replayHub.auth.login(username, password);
        
        if (result.success) {
            updateLoginStatus(true);
            // Close login modal if it exists
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.style.display = 'none';
            }
            
            // Show success message
            showMessage('Login successful!', 'success');
            
            return result;
        } else {
            showMessage(result.error || 'Login failed', 'error');
            return result;
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Login failed due to network error', 'error');
        return { success: false, error: error.message };
    }
}

// Register function for UI
async function registerUser(userData) {
    try {
        if (!window.replayHub || !window.replayHub.auth) {
            throw new Error('Authentication module not loaded');
        }
        
        const result = await window.replayHub.auth.register(userData);
        
        if (result.success) {
            updateLoginStatus(true);
            // Close register modal if it exists
            const registerModal = document.getElementById('registerModal');
            if (registerModal) {
                registerModal.style.display = 'none';
            }
            
            // Show success message
            showMessage('Registration successful! Welcome to Replay Hub!', 'success');
            
            return result;
        } else {
            showMessage(result.error || 'Registration failed', 'error');
            return result;
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Registration failed due to network error', 'error');
        return { success: false, error: error.message };
    }
}

// Logout function for UI
async function logoutUser() {
    try {
        if (window.replayHub && window.replayHub.auth) {
            await window.replayHub.auth.logout();
        }
        updateLoginStatus(false);
        showMessage('Logged out successfully', 'info');
    } catch (error) {
        console.error('Logout error:', error);
        // Still update UI even if server logout fails
        updateLoginStatus(false);
    }
}

// Make login, register, and logout functions globally accessible
window.login = function() {
    console.log('Login function called - opening login modal');
    showLoginModal();
};

window.register = function() {
    console.log('Register function called - opening register modal');
    showRegisterModal();
};

window.logout = function() {
    console.log('Logout function called');
    logoutUser();
};

// Use the global functions for UI event handlers
function login() {
    window.login();
}

function register() {
    window.register();
}

function logout() {
    window.logout();
}

function updateLoginStatus(isLoggedIn) {
    console.log('updateLoginStatus called with:', isLoggedIn);
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');
    const uploadButton = document.getElementById('upload-button');
    
    console.log('Button elements found:', {
        loginButton: !!loginButton,
        registerButton: !!registerButton,
        uploadButton: !!uploadButton
    });
    
    // Update current user information
    if (isLoggedIn && window.replayHub && window.replayHub.auth) {
        const user = window.replayHub.auth.getCurrentUser();
        if (user) {
            currentUser.id = user.id;
            currentUser.name = user.display_name || user.username;
            currentUser.username = user.username;
            currentUser.email = user.email;
            currentUser.avatar = user.profile_picture;
            currentUser.isLoggedIn = true;
            console.log('User logged in:', currentUser.name);
        }
    } else {
        currentUser.id = 'guest-user';
        currentUser.name = 'Guest User';
        currentUser.username = null;
        currentUser.email = null;
        currentUser.avatar = null;
        currentUser.isLoggedIn = false;
        console.log('User logged out or not authenticated');
    }
    
    // Update UI with login status
    if (loginButton) {
        console.log('Updating UI, isLoggedIn:', isLoggedIn);
        if (isLoggedIn) {
            // Create profile button if it doesn't exist
            let profileButton = document.getElementById('profile-button');
            console.log('Profile button exists:', !!profileButton);
            if (!profileButton) {
                const userActions = document.querySelector('.user-actions');
                if (userActions) {
                    profileButton = document.createElement('div');
                    profileButton.id = 'profile-button';
                    profileButton.className = 'profile-button';
                    
                    // Create dropdown menu
                    const dropdown = document.createElement('div');
                    dropdown.className = 'profile-dropdown';
                    
                    // Add profile avatar and name
                    const avatar = document.createElement('div');
                    avatar.className = 'avatar';
                    if (currentUser.avatar) {
                        avatar.innerHTML = `<img src="${currentUser.avatar}" alt="${currentUser.name}" />`;
                    } else {
                        // Use Font Awesome user icon as default
                        avatar.innerHTML = '<i class="fas fa-user"></i>';
                    }
                    
                    const username = document.createElement('span');
                    username.className = 'username';
                    username.textContent = currentUser.name;
                    
                    // Add dropdown toggle
                    const dropdownToggle = document.createElement('div');
                    dropdownToggle.className = 'dropdown-toggle';
                    dropdownToggle.appendChild(avatar);
                    dropdownToggle.appendChild(username);
                    
                    // Add dropdown menu
                    const dropdownMenu = document.createElement('div');
                    dropdownMenu.className = 'dropdown-menu';
                    
                    // Add profile option
                    const profileOption = document.createElement('a');
                    profileOption.href = '#';
                    profileOption.className = 'dropdown-item';
                    profileOption.innerHTML = '<i class="fas fa-user"></i> Profile';
                    profileOption.onclick = (e) => {
                        e.preventDefault();
                        showProfileModal();
                    };
                    
                    // Add logout option
                    const logoutOption = document.createElement('a');
                    logoutOption.href = '#';
                    logoutOption.className = 'dropdown-item';
                    logoutOption.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
                    logoutOption.onclick = logout;
                    
                    // Assemble dropdown menu
                    dropdownMenu.appendChild(profileOption);
                    dropdownMenu.appendChild(document.createElement('hr'));
                    dropdownMenu.appendChild(logoutOption);
                    
                    // Assemble dropdown
                    dropdown.appendChild(dropdownToggle);
                    dropdown.appendChild(dropdownMenu);
                    profileButton.appendChild(dropdown);
                    
                    // Add click handler to toggle dropdown
                    dropdownToggle.addEventListener('click', (e) => {
                        e.preventDefault();
                        dropdownMenu.classList.toggle('show');
                    });
                    
                    // Close dropdown when clicking outside
                    document.addEventListener('click', (e) => {
                        if (!profileButton.contains(e.target)) {
                            dropdownMenu.classList.remove('show');
                        }
                    });
                    
                    // Add to user actions
                    userActions.appendChild(profileButton);
                }
            } else {
                // Update existing profile button
                const avatar = profileButton.querySelector('.avatar');
                const username = profileButton.querySelector('.username');
                
                if (avatar) {
                    if (currentUser.avatar) {
                        avatar.innerHTML = `<img src="${currentUser.avatar}" alt="${currentUser.name}" />`;
                    } else {
                        // Use Font Awesome user icon as default
                        avatar.innerHTML = '<i class="fas fa-user"></i>';
                    }
                }
                
                if (username) {
                    username.textContent = currentUser.name;
                }
            }
            
            // Hide login/register buttons
            if (loginButton) {
                loginButton.style.display = 'none';
                console.log('Login button hidden');
            }
            if (registerButton) {
                registerButton.style.display = 'none';
                console.log('Register button hidden');
            }
            
            // Show profile button
            if (profileButton) {
                profileButton.style.display = 'block';
                console.log('Profile button shown');
            }
        } else {
            // Show login/register buttons
            if (loginButton) {
                loginButton.style.display = 'block';
                console.log('Login button shown');
            }
            if (registerButton) {
                registerButton.style.display = 'block';
                console.log('Register button shown');
            }
            
            // Hide and remove profile button
            const profileButton = document.getElementById('profile-button');
            if (profileButton) {
                profileButton.remove();
                console.log('Profile button removed');
            }
        }
    }
    
    // Enable/disable upload button based on authentication
    if (uploadButton) {
        if (isLoggedIn) {
            uploadButton.disabled = false;
            uploadButton.title = 'Upload a video';
        } else {
            uploadButton.disabled = true; // Require authentication for uploads
            uploadButton.title = 'Please login to upload videos';
        }
    }
}

// Message display function
function showMessage(message, type = 'info') {
    // Create or update message element
    let messageEl = document.getElementById('auth-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'auth-message';
        messageEl.className = 'auth-message';
        document.body.appendChild(messageEl);
    }
    
    messageEl.textContent = message;
    messageEl.className = `auth-message ${type}`;
    messageEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

// Modal functions
function showLoginModal() {
    let modal = document.getElementById('loginModal');
    if (!modal) {
        modal = createLoginModal();
        document.body.appendChild(modal);
    }
    modal.style.display = 'block';
}

function showRegisterModal() {
    let modal = document.getElementById('registerModal');
    if (!modal) {
        modal = createRegisterModal();
        document.body.appendChild(modal);
    }
    modal.style.display = 'block';
}

function showProfileModal() {
    let modal = document.getElementById('profileModal');
    if (!modal) {
        modal = createProfileModal();
        document.body.appendChild(modal);
    }
    
    // Populate form with current user data
    const user = window.replayHub.auth.getCurrentUser();
    if (user) {
        document.getElementById('profile-first-name').value = user.first_name || '';
        document.getElementById('profile-last-name').value = user.last_name || '';
        document.getElementById('profile-bio').value = user.bio || '';
        
        const avatarPreview = document.getElementById('profile-avatar-preview');
        if (user.profile_picture) {
            avatarPreview.innerHTML = `<img src="${user.profile_picture}" alt="Profile Picture" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;" />`;
        } else {
            avatarPreview.innerHTML = `<div style="width: 100px; height: 100px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center; font-size: 2em;">${user.display_name.charAt(0).toUpperCase()}</div>`;
        }
    }
    
    modal.style.display = 'block';
}

function createLoginModal() {
    const modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Login to Replay Hub</h2>
                <span class="close" onclick="document.getElementById('loginModal').style.display='none'">&times;</span>
            </div>
            <form id="loginForm" onsubmit="handleLogin(event)">
                <div class="form-group">
                    <label for="login-username">Username or Email:</label>
                    <input type="text" id="login-username" name="username" required>
                </div>
                <div class="form-group">
                    <label for="login-password">Password:</label>
                    <input type="password" id="login-password" name="password" required>
                </div>
                <div class="form-actions">
                    <button type="submit">Login</button>
                    <button type="button" onclick="showRegisterModal(); document.getElementById('loginModal').style.display='none'">Need an account? Register</button>
                </div>
            </form>
        </div>
    `;
    return modal;
}

function createRegisterModal() {
    const modal = document.createElement('div');
    modal.id = 'registerModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Join Replay Hub</h2>
                <span class="close" onclick="document.getElementById('registerModal').style.display='none'">&times;</span>
            </div>
            <form id="registerForm" onsubmit="handleRegister(event)">
                <div class="form-group">
                    <label for="register-username">Username:</label>
                    <input type="text" id="register-username" name="username" required minlength="3" maxlength="30" pattern="[a-zA-Z0-9_-]+">
                    <small>3-30 characters, letters, numbers, underscores, and hyphens only</small>
                </div>
                <div class="form-group">
                    <label for="register-email">Email:</label>
                    <input type="email" id="register-email" name="email" required>
                </div>
                <div class="form-group">
                    <label for="register-password">Password:</label>
                    <input type="password" id="register-password" name="password" required minlength="8">
                    <small>At least 8 characters</small>
                </div>
                <div class="form-group">
                    <label for="register-first-name">First Name (optional):</label>
                    <input type="text" id="register-first-name" name="first_name">
                </div>
                <div class="form-group">
                    <label for="register-last-name">Last Name (optional):</label>
                    <input type="text" id="register-last-name" name="last_name">
                </div>
                <div class="form-group">
                    <label for="register-profile-picture">Profile Picture (optional):</label>
                    <input type="file" id="register-profile-picture" name="profile_picture" accept="image/*">
                </div>
                <div class="form-actions">
                    <button type="submit">Register</button>
                    <button type="button" onclick="showLoginModal(); document.getElementById('registerModal').style.display='none'">Already have an account? Login</button>
                </div>
            </form>
        </div>
    `;
    return modal;
}

function createProfileModal() {
    const modal = document.createElement('div');
    modal.id = 'profileModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Edit Profile</h2>
                <span class="close" onclick="document.getElementById('profileModal').style.display='none'">&times;</span>
            </div>
            <form id="profileForm" onsubmit="handleProfileUpdate(event)">
                <div class="form-group">
                    <label>Current Profile Picture:</label>
                    <div id="profile-avatar-preview"></div>
                </div>
                <div class="form-group">
                    <label for="profile-picture">New Profile Picture (optional):</label>
                    <input type="file" id="profile-picture" name="profile_picture" accept="image/*">
                </div>
                <div class="form-group">
                    <label for="profile-first-name">First Name:</label>
                    <input type="text" id="profile-first-name" name="first_name">
                </div>
                <div class="form-group">
                    <label for="profile-last-name">Last Name:</label>
                    <input type="text" id="profile-last-name" name="last_name">
                </div>
                <div class="form-group">
                    <label for="profile-bio">Bio:</label>
                    <textarea id="profile-bio" name="bio" rows="3" maxlength="500"></textarea>
                </div>
                <div class="form-actions">
                    <button type="submit">Update Profile</button>
                    <button type="button" onclick="showChangePasswordModal()">Change Password</button>
                </div>
            </form>
        </div>
    `;
    return modal;
}

// Form handlers
async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const username = formData.get('username');
    const password = formData.get('password');
    
    await loginUser(username, password);
}

async function handleRegister(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const userData = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        profile_picture: formData.get('profile_picture')
    };
    
    await registerUser(userData);
}

async function handleProfileUpdate(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const userData = {
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        bio: formData.get('bio'),
        profile_picture: formData.get('profile_picture')
    };
    
    try {
        const result = await window.replayHub.auth.updateProfile(userData);
        if (result.success) {
            updateLoginStatus(true);
            document.getElementById('profileModal').style.display = 'none';
            showMessage('Profile updated successfully!', 'success');
        }
    } catch (error) {
        console.error('Profile update error:', error);
        showMessage('Failed to update profile', 'error');
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = ['loginModal', 'registerModal', 'profileModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};

// Initialize authentication when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing authentication...');
    // Add a small delay to ensure auth module is loaded
    setTimeout(initializeAuth, 100);
});

// Also try to initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading
} else {
    // DOM is already loaded
    setTimeout(initializeAuth, 100);
}

// Global state
let allVideos = []; 

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
        
        // Add JWT authentication header if available
        if (window.replayHub && window.replayHub.auth && window.replayHub.auth.isAuthenticated()) {
            const token = localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
        }
        
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
    const uploader = formData.get('uploader');
    const players = formData.get('players'); // Pass along player data if available
    
    if (!file) {
        throw new Error('No file found in form data');
    }
    
    // Configuration for chunked upload
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    let uploadedChunks = 0;
    let totalUploaded = 0;
    
    console.log(`Preparing chunked upload: ${totalChunks} chunks of ${chunkSize} bytes`);
    
    // Generate a unique file ID for this upload
    const fileId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    try {
        // First, send initialization request to let the server know a chunked upload is starting
        const initForm = new FormData();
        initForm.append('action', 'init_chunked_upload');
        initForm.append('title', title);
        initForm.append('description', description);
        initForm.append('uploader', uploader);
        if (players) initForm.append('players', players);
        initForm.append('filename', file.name);
        initForm.append('fileSize', file.size.toString());
        initForm.append('totalChunks', totalChunks.toString());
        initForm.append('fileId', fileId);
        initForm.append('s3', 'true');
        
        // Add authentication header for initialization request
        const initHeaders = {};
        if (window.replayHub && window.replayHub.auth && window.replayHub.auth.isAuthenticated()) {
            const token = localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token');
            if (token) {
                initHeaders['Authorization'] = `Bearer ${token}`;
            }
        }
        
        // Send initialization request
        const initResponse = await fetch(`${BASE_URL}/upload/init`, {
            method: 'POST',
            headers: initHeaders,
            body: initForm
        });
        
        if (!initResponse.ok) {
            throw new Error(`Failed to initialize chunked upload: ${initResponse.status}`);
        }
        
        // Process each chunk
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            // Create a form for this chunk
            const chunkForm = new FormData();
            chunkForm.append('file', chunk, `chunk_${fileId}_${chunkIndex}_of_${totalChunks}`);
            chunkForm.append('fileId', fileId);
            chunkForm.append('chunkIndex', chunkIndex.toString());
            chunkForm.append('totalChunks', totalChunks.toString());
            chunkForm.append('originalFilename', file.name);
            chunkForm.append('s3', 'true');
            
            // Upload this chunk
            try {
                const xhr = new XMLHttpRequest();
                
                await new Promise((resolveChunk, rejectChunk) => {
                    xhr.open('POST', `${BASE_URL}/upload/chunk`, true);
                    
                    // Add JWT authentication header for chunk upload
                    if (window.replayHub && window.replayHub.auth && window.replayHub.auth.isAuthenticated()) {
                        const token = localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token');
                        if (token) {
                            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                        }
                    }
                    
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
                        if (xhr.status === 200 || xhr.status === 201) {
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
                throw new Error(`Failed to upload chunk ${chunkIndex}: ${chunkError.message}`);
            }
        }
        
        // All chunks uploaded, now tell the server to finalize (combine chunks)
        console.log('All chunks uploaded successfully, finalizing...');
        
        const finalizeForm = new FormData();
        finalizeForm.append('action', 'finalize_chunked_upload');
        finalizeForm.append('fileId', fileId);
        finalizeForm.append('filename', file.name);
        finalizeForm.append('totalChunks', totalChunks.toString());
        finalizeForm.append('title', title);
        finalizeForm.append('description', description);
        finalizeForm.append('uploader', uploader);
        if (players) finalizeForm.append('players', players);
        
        // Add authentication header for finalization request
        const finalizeHeaders = {};
        if (window.replayHub && window.replayHub.auth && window.replayHub.auth.isAuthenticated()) {
            const token = localStorage.getItem('replay_hub_token') || sessionStorage.getItem('replay_hub_token');
            if (token) {
                finalizeHeaders['Authorization'] = `Bearer ${token}`;
            }
        }
        
        const finalizeResponse = await fetch(`${BASE_URL}/upload/finalize`, {
            method: 'POST',
            headers: finalizeHeaders,
            body: finalizeForm
        });
        
        if (!finalizeResponse.ok) {
            throw new Error(`Failed to finalize upload: ${finalizeResponse.status}`);
        }
        
        const responseData = await finalizeResponse.json();
        
        if (progressCallback) {
            progressCallback(100);
        }
        
        return responseData;
        
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
        // Use only the short video ID in the URL (not the S3 URL or Mongo _id)
        let idToUse = video.short_id || '';
        if (!idToUse && video.id) idToUse = video.id;
        if (!idToUse && video.s3_url) {
            // fallback: extract from s3_url if possible (legacy)
            try {
                const s3UrlParts = video.s3_url.split('/');
                const filename = s3UrlParts[s3UrlParts.length - 1];
                const filenameWithoutExt = filename.split('.')[0];
                const uuidMatch = filenameWithoutExt.match(/([a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12})|([a-f0-9]{32})/i);
                if (uuidMatch) {
                    idToUse = uuidMatch[0];
                }
            } catch (e) {
                console.warn('Error extracting ID from S3 URL:', e);
            }
        }
        if (idToUse) {
            window.location.href = `video.html?id=${encodeURIComponent(idToUse)}`;
        } else {
            alert('Sorry, this video is currently unavailable.');
        }
    });
    
    return card;
}

// Initialize the page based on current URL
function initPage() {
    const path = window.location.pathname;
    
    // Always initialize authentication buttons first
    initAuthButtons();
    
    // Always initialize upload modal
    initUploadModal();
    
    // Then initialize page-specific functionality
    if (path.endsWith('index.html') || path === '/' || path === '') {
        initHomePage();
    }
    // Note: video.html initialization is now handled by video.js
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

// Note: initVideoPage function has been moved to video.js for better organization
// This stub remains for compatibility but video.js handles the full implementation

// Initialize authentication buttons
function initAuthButtons() {
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');
    
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            console.log('Login button clicked');
            showLoginModal();
        });
    }
    
    if (registerButton) {
        registerButton.addEventListener('click', () => {
            console.log('Register button clicked');
            showRegisterModal();
        });
    }
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
            
            // Check if user is logged in
            if (!currentUser.isLoggedIn) {
                console.log('User not logged in, prompting for login');
                alert('Please log in to upload videos.');
                login();
                return;
            }
            
            if (modalOverlay) {
                // Use the active class instead of display style
                modalOverlay.classList.add('active');
                console.log('Modal displayed');
                
                // Pre-fill uploader with current username
                const uploaderInput = document.getElementById('video-uploader');
                const bulkUploaderInput = document.getElementById('bulk-video-uploader');
                
                if (uploaderInput) {
                    uploaderInput.value = currentUser.name;
                    uploaderInput.disabled = true; // Disable editing
                }
                
                if (bulkUploaderInput) {
                    bulkUploaderInput.value = currentUser.name;
                    bulkUploaderInput.disabled = true; // Disable editing
                }
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
            
            // Check authentication before processing upload
            if (!currentUser.isLoggedIn) {
                alert('Please log in to upload videos.');
                return;
            }
            
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
            
            if (!titleInput.value) {
                alert('Please enter a title for the video');
                titleInput.focus();
                return;
            }
            
            if (!descriptionInput.value) {
                alert('Please enter a description for the video');
                descriptionInput.focus();
                return;
            }
              // No need to check for username, as it's pre-filled and disabled for logged-in users
            
            // Show progress bar
            if (progressContainer) progressContainer.style.display = 'block';
            if (uploadStatus) uploadStatus.textContent = 'Preparing to upload...';
            
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('title', titleInput.value);
            formData.append('description', descriptionInput.value);
            formData.append('uploader', uploaderInput.value);
            formData.append('s3', 'true'); // Always upload to S3
            
            // Add players if available
            if (playersInput && playersInput.value) {
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
            
            // Check authentication before processing upload
            if (!currentUser.isLoggedIn) {
                alert('Please log in to upload videos.');
                return;
            }
            
            const uploaderInput = document.getElementById('bulk-video-uploader');
            
            if (!selectedBulkFiles || selectedBulkFiles.length === 0) {
                alert('Please select at least one video file to upload');
                return;
            }
              // No need to check for username, as it's pre-filled and disabled for logged-in users
            
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
        
        // Re-fill username fields for logged-in users
        const uploaderInput = document.getElementById('video-uploader');
        const bulkUploaderInput = document.getElementById('bulk-video-uploader');
        
        if (currentUser.isLoggedIn) {
            if (uploaderInput) {
                uploaderInput.value = currentUser.name;
                uploaderInput.disabled = true;
            }
            
            if (bulkUploaderInput) {
                bulkUploaderInput.value = currentUser.name;
                bulkUploaderInput.disabled = true;
            }
        } else {
            if (uploaderInput) {
                uploaderInput.disabled = false;
            }
            
            if (bulkUploaderInput) {
                bulkUploaderInput.disabled = false;
            }
        }
        
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