/**
 * Enhanced Upload Progress Tracker
 * Provides detailed progress information for video conversion and upload phases
 */

class UploadProgressTracker {
    constructor() {
        this.startTime = null;
        this.conversionStartTime = null;
        this.uploadStartTime = null;
        this.lastUpdateTime = null;
        this.lastUploadedBytes = 0;
        this.uploadSpeed = 0;
        this.conversionProgress = 0;
        this.uploadProgress = 0;
        this.originalFileSize = 0;
        this.convertedFileSize = 0;
        this.uploadedBytes = 0;
        this.totalBytes = 0;
        this.phase = 'idle'; // 'idle', 'converting', 'uploading', 'complete'
        
        // DOM elements
        this.elements = {};
        this.initializeElements();
    }
    
    /**
     * Initialize DOM element references
     */
    initializeElements() {
        const elementIds = [
            'conversion-progress', 'conversion-status', 'conversion-progress-bar', 'conversion-progress-text',
            'original-size', 'target-size', 'conversion-time-elapsed', 'conversion-time-remaining',
            'upload-progress', 'upload-status', 'upload-progress-bar', 'upload-progress-text',
            'uploaded-size', 'remaining-size', 'upload-speed', 'upload-eta',
            'overall-progress-bar', 'overall-progress-text', 'overall-status'
        ];
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }
    
    /**
     * Start tracking progress for a new upload
     */
    startUpload(originalFile, convertedFile = null) {
        this.reset();
        this.startTime = Date.now();
        this.originalFileSize = originalFile.size;
        this.convertedFileSize = convertedFile ? convertedFile.size : originalFile.size;
        this.totalBytes = this.convertedFileSize;
        
        // Show progress container
        const progressContainer = document.getElementById('progress-container');
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        
        // Update file size displays
        this.updateElement('original-size', this.formatFileSize(this.originalFileSize));
        this.updateElement('target-size', this.formatFileSize(this.convertedFileSize));
        
        if (convertedFile && convertedFile !== originalFile) {
            const sizeReduction = ((this.originalFileSize - this.convertedFileSize) / this.originalFileSize * 100).toFixed(1);
            this.updateElement('overall-status', `Conversion complete! ${sizeReduction}% size reduction`);
        }
    }
    
    /**
     * Start conversion phase
     */
    startConversion() {
        this.phase = 'converting';
        this.conversionStartTime = Date.now();
        this.lastUpdateTime = Date.now();
        
        // Show conversion progress
        this.showElement('conversion-progress');
        this.updateElement('conversion-status', 'Converting video to H.265...');
        this.updateElement('overall-status', 'Converting video...');
        
        // Start conversion progress updates
        this.startConversionProgress();
    }
    
    /**
     * Start upload phase
     */
    startUploadPhase() {
        this.phase = 'uploading';
        this.uploadStartTime = Date.now();
        this.lastUpdateTime = Date.now();
        
        // Hide conversion progress, show upload progress
        this.hideElement('conversion-progress');
        this.showElement('upload-progress');
        this.updateElement('upload-status', 'Uploading to Replay Hub...');
        this.updateElement('overall-status', 'Uploading video...');
        
        // Set initial upload progress
        this.updateUploadProgress(0, 0);
    }
    
    /**
     * Update conversion progress
     */
    updateConversionProgress(progress, estimatedTimeRemaining = null) {
        this.conversionProgress = Math.min(100, Math.max(0, progress));
        
        // Update conversion progress bar
        this.updateElement('conversion-progress-bar', 'width', `${this.conversionProgress}%`);
        this.updateElement('conversion-progress-text', `${Math.round(this.conversionProgress)}%`);
        
        // Update time information
        const elapsed = Date.now() - this.conversionStartTime;
        this.updateElement('conversion-time-elapsed', this.formatTime(elapsed));
        
        if (estimatedTimeRemaining) {
            this.updateElement('conversion-time-remaining', this.formatTime(estimatedTimeRemaining));
        }
        
        // Update overall progress (conversion is 30% of total process)
        const overallProgress = (this.conversionProgress * 0.3);
        this.updateOverallProgress(overallProgress);
    }
    
    /**
     * Update upload progress
     */
    updateUploadProgress(uploadedBytes, totalBytes) {
        this.uploadedBytes = uploadedBytes;
        this.totalBytes = totalBytes;
        
        const progress = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
        this.uploadProgress = Math.min(100, Math.max(0, progress));
        
        // Update upload progress bar
        this.updateElement('upload-progress-bar', 'width', `${this.uploadProgress}%`);
        this.updateElement('upload-progress-text', `${Math.round(this.uploadProgress)}%`);
        
        // Calculate upload speed and ETA
        this.calculateUploadMetrics();
        
        // Update upload details
        this.updateElement('uploaded-size', this.formatFileSize(uploadedBytes));
        this.updateElement('remaining-size', this.formatFileSize(totalBytes - uploadedBytes));
        this.updateElement('upload-speed', this.formatSpeed(this.uploadSpeed));
        this.updateElement('upload-eta', this.formatTime(this.calculateETA()));
        
        // Update overall progress (upload is 70% of total process, conversion was 30%)
        const overallProgress = 30 + (this.uploadProgress * 0.7);
        this.updateOverallProgress(overallProgress);
    }
    
    /**
     * Calculate upload metrics (speed, ETA)
     */
    calculateUploadMetrics() {
        const now = Date.now();
        const timeDiff = (now - this.lastUpdateTime) / 1000; // seconds
        
        if (timeDiff > 0) {
            const bytesDiff = this.uploadedBytes - this.lastUploadedBytes;
            this.uploadSpeed = bytesDiff / timeDiff; // bytes per second
            
            this.lastUpdateTime = now;
            this.lastUploadedBytes = this.uploadedBytes;
        }
    }
    
    /**
     * Calculate estimated time to completion
     */
    calculateETA() {
        if (this.uploadSpeed <= 0) return 0;
        
        const remainingBytes = this.totalBytes - this.uploadedBytes;
        return remainingBytes / this.uploadSpeed * 1000; // milliseconds
    }
    
    /**
     * Update overall progress
     */
    updateOverallProgress(progress) {
        const overallProgress = Math.min(100, Math.max(0, progress));
        
        this.updateElement('overall-progress-bar', 'width', `${overallProgress}%`);
        this.updateElement('overall-progress-text', `${Math.round(overallProgress)}%`);
        
        if (overallProgress >= 100) {
            this.complete();
        }
    }
    
    /**
     * Complete the upload process
     */
    complete() {
        this.phase = 'complete';
        this.updateElement('overall-status', 'Upload complete! 🎉');
        this.updateElement('upload-status', 'Upload successful!');
        
        // Hide progress after a delay
        setTimeout(() => {
            const progressContainer = document.getElementById('progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        }, 3000);
    }
    
    /**
     * Reset progress tracker
     */
    reset() {
        this.startTime = null;
        this.conversionStartTime = null;
        this.uploadStartTime = null;
        this.lastUpdateTime = null;
        this.lastUploadedBytes = 0;
        this.uploadSpeed = 0;
        this.conversionProgress = 0;
        this.uploadProgress = 0;
        this.originalFileSize = 0;
        this.convertedFileSize = 0;
        this.uploadedBytes = 0;
        this.totalBytes = 0;
        this.phase = 'idle';
        
        // Reset all progress bars
        this.updateElement('conversion-progress-bar', 'width', '0%');
        this.updateElement('conversion-progress-text', '0%');
        this.updateElement('upload-progress-bar', 'width', '0%');
        this.updateElement('upload-progress-text', '0%');
        this.updateElement('overall-progress-bar', 'width', '0%');
        this.updateElement('overall-progress-text', '0%');
        
        // Hide progress sections
        this.hideElement('conversion-progress');
        this.hideElement('upload-progress');
    }
    
    /**
     * Simulate conversion progress (for testing)
     */
    startConversionProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15; // Random progress increment
            
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                this.updateElement('conversion-status', 'Conversion complete!');
                this.updateElement('overall-status', 'Conversion finished, starting upload...');
                
                // Simulate conversion completion delay
                setTimeout(() => {
                    this.startUploadPhase();
                }, 1000);
            }
            
            this.updateConversionProgress(progress);
        }, 200);
    }
    
    /**
     * Utility methods
     */
    updateElement(elementId, property, value) {
        const element = this.elements[elementId];
        if (!element) return;
        
        if (typeof property === 'string' && value !== undefined) {
            element.style[property] = value;
        } else {
            element.textContent = property;
        }
    }
    
    showElement(elementId) {
        const element = this.elements[elementId];
        if (element) element.style.display = 'block';
    }
    
    hideElement(elementId) {
        const element = this.elements[elementId];
        if (element) element.style.display = 'none';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    formatSpeed(bytesPerSecond) {
        if (bytesPerSecond === 0) return '-';
        return this.formatFileSize(bytesPerSecond) + '/s';
    }
    
    formatTime(milliseconds) {
        if (milliseconds <= 0) return '--:--';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UploadProgressTracker;
} else {
    window.UploadProgressTracker = UploadProgressTracker;
}

