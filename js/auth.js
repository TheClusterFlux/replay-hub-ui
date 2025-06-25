/**
 * Authentication module for Replay Hub
 * Handles user registration, login, logout, and JWT token management
 */

// Initialize the global replayHub object if needed
window.replayHub = window.replayHub || {};

(function() {
    // Configuration
    const API_BASE = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
    const TOKEN_KEY = 'replay_hub_token';
    const USER_KEY = 'replay_hub_user';
    
    // Current user state
    let currentUser = null;
    let authToken = null;
    
    /**
     * Get stored authentication token
     */
    function getStoredToken() {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch (e) {
            console.warn('localStorage not available, using session storage');
            return sessionStorage.getItem(TOKEN_KEY);
        }
    }
    
    /**
     * Store authentication token
     */
    function storeToken(token) {
        try {
            localStorage.setItem(TOKEN_KEY, token);
        } catch (e) {
            console.warn('localStorage not available, using session storage');
            sessionStorage.setItem(TOKEN_KEY, token);
        }
    }
    
    /**
     * Remove stored authentication token
     */
    function removeStoredToken() {
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        } catch (e) {
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
        }
    }
    
    /**
     * Get stored user data
     */
    function getStoredUser() {
        try {
            const userData = localStorage.getItem(USER_KEY);
            return userData ? JSON.parse(userData) : null;
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Store user data
     */
    function storeUser(user) {
        try {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        } catch (e) {
            console.warn('Could not store user data');
        }
    }
    
    /**
     * Make authenticated API request
     */
    async function makeAuthenticatedRequest(url, options = {}) {
        const token = authToken || getStoredToken();
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return fetch(url, {
            ...options,
            headers
        });
    }
    
    /**
     * Verify current token with server
     */
    async function verifyToken(token = null) {
        try {
            const tokenToVerify = token || authToken || getStoredToken();
            if (!tokenToVerify) return false;
            
            const response = await fetch(`${API_BASE}/api/auth/verify-token`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenToVerify}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.valid && data.user) {
                    currentUser = data.user;
                    authToken = tokenToVerify;
                    storeToken(tokenToVerify);
                    storeUser(data.user);
                    return true;
                }
            }
            
            // Token is invalid, clean up
            await logout(false);
            return false;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }
    
    /**
     * Register a new user
     */
    async function register(userData) {
        try {
            const formData = new FormData();
            
            // Add text fields
            Object.keys(userData).forEach(key => {
                if (key !== 'profile_picture' && userData[key] !== undefined) {
                    formData.append(key, userData[key]);
                }
            });
            
            // Add profile picture if provided
            if (userData.profile_picture && userData.profile_picture instanceof File) {
                formData.append('profile_picture', userData.profile_picture);
            }
            
            const response = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Registration successful
                currentUser = data.user;
                authToken = data.token;
                storeToken(data.token);
                storeUser(data.user);
                
                console.log('Registration successful:', data.user.username);
                return { success: true, user: data.user, message: data.message };
            } else {
                console.error('Registration failed:', data.error);
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Network error during registration' };
        }
    }
    
    /**
     * Login user
     */
    async function login(username, password) {
        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Login successful
                currentUser = data.user;
                authToken = data.token;
                storeToken(data.token);
                storeUser(data.user);
                
                console.log('Login successful:', data.user.username);
                return { success: true, user: data.user, message: data.message };
            } else {
                console.error('Login failed:', data.error);
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error during login' };
        }
    }
    
    /**
     * Logout user
     */
    async function logout(notifyServer = true) {
        try {
            // Notify server about logout
            if (notifyServer && authToken) {
                await makeAuthenticatedRequest(`${API_BASE}/api/auth/logout`, {
                    method: 'POST'
                });
            }
        } catch (error) {
            console.warn('Server logout notification failed:', error);
        } finally {
            // Clear local state regardless of server response
            currentUser = null;
            authToken = null;
            removeStoredToken();
            console.log('User logged out');
        }
    }
    
    /**
     * Get current user
     */
    function getCurrentUser() {
        return currentUser;
    }
    
    /**
     * Check if user is authenticated
     */
    function isAuthenticated() {
        return !!(currentUser && authToken);
    }
    
    /**
     * Update user profile
     */
    async function updateProfile(userData) {
        try {
            const formData = new FormData();
            
            // Add text fields
            Object.keys(userData).forEach(key => {
                if (key !== 'profile_picture' && userData[key] !== undefined) {
                    formData.append(key, userData[key]);
                }
            });
            
            // Add profile picture if provided
            if (userData.profile_picture && userData.profile_picture instanceof File) {
                formData.append('profile_picture', userData.profile_picture);
            }
            
            const response = await makeAuthenticatedRequest(`${API_BASE}/api/auth/me`, {
                method: 'PUT',
                body: formData,
                headers: {} // Don't set Content-Type for FormData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                currentUser = data.user;
                storeUser(data.user);
                console.log('Profile updated successfully');
                return { success: true, user: data.user, message: data.message };
            } else {
                console.error('Profile update failed:', data.error);
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Profile update error:', error);
            return { success: false, error: 'Network error during profile update' };
        }
    }
    
    /**
     * Change user password
     */
    async function changePassword(currentPassword, newPassword) {
        try {
            const response = await makeAuthenticatedRequest(`${API_BASE}/api/auth/change-password`, {
                method: 'POST',
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('Password changed successfully');
                return { success: true, message: data.message };
            } else {
                console.error('Password change failed:', data.error);
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Password change error:', error);
            return { success: false, error: 'Network error during password change' };
        }
    }
    
    /**
     * Initialize authentication on page load
     */
    async function initAuth() {
        try {
            // Try to load user from storage first
            const storedUser = getStoredUser();
            const storedToken = getStoredToken();
            
            if (storedUser && storedToken) {
                currentUser = storedUser;
                authToken = storedToken;
                
                // Verify token is still valid
                const isValid = await verifyToken(storedToken);
                if (isValid) {
                    console.log('User authenticated from storage:', currentUser.username);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Auth initialization error:', error);
            return false;
        }
    }
    
    /**
     * Add authorization header to fetch requests
     */
    function addAuthToRequest(options = {}) {
        const token = authToken || getStoredToken();
        
        if (token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }
        
        return options;
    }
    
    // Export auth functions
    window.replayHub.auth = {
        register,
        login,
        logout,
        getCurrentUser,
        isAuthenticated,
        updateProfile,
        changePassword,
        initAuth,
        verifyToken,
        addAuthToRequest,
        makeAuthenticatedRequest
    };
    
    // Initialize authentication when module loads
    initAuth().then(isAuthenticated => {
        if (isAuthenticated) {
            // Update UI to show authenticated state
            if (typeof updateLoginStatus === 'function') {
                updateLoginStatus(true);
            }
        }
    });
    
})(); 