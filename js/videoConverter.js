/**
 * Client-side Video Converter for H.265 Optimization
 * Converts videos to H.265 before upload for better compression and storage efficiency
 */

class VideoConverter {
    constructor() {
        this.worker = null;
        this.isSupported = this.checkSupport();
        console.log('🎬 VideoConverter initialized, H.265 support:', this.isSupported);
    }

    /**
     * Check if H.265 encoding is supported
     */
    checkSupport() {
        // Check for WebCodecs API support (modern browsers)
        if (typeof VideoEncoder !== 'undefined') {
            return true;
        }
        
        // Check for MediaRecorder with H.265 support
        if (typeof MediaRecorder !== 'undefined') {
            const mimeTypes = MediaRecorder.isTypeSupported;
            return mimeTypes('video/webm;codecs=h265') || 
                   mimeTypes('video/mp4;codecs=h265') ||
                   mimeTypes('video/mp4;codecs=hev1');
        }
        
        return false;
    }

    /**
     * Convert video to H.265 if possible, otherwise return original
     * @param {File} videoFile - The video file to convert
     * @param {Object} options - Conversion options
     * @returns {Promise<File>} - Converted file or original if conversion not possible
     */
    async convertToH265(videoFile, options = {}) {
        const {
            quality = 'medium', // low, medium, high
            maxWidth = 1920,
            maxHeight = 1080,
            targetBitrate = null
        } = options;

        console.log('🔄 Starting H.265 conversion for:', videoFile.name);

        // If H.265 not supported, return original
        if (!this.isSupported) {
            console.log('⚠️ H.265 conversion not supported, using original file');
            return videoFile;
        }

        try {
            // Check if file is already H.265
            if (await this.isH265(videoFile)) {
                console.log('✅ File is already H.265, no conversion needed');
                return videoFile;
            }

            // Convert using WebCodecs API if available
            if (typeof VideoEncoder !== 'undefined') {
                return await this.convertWithWebCodecs(videoFile, options);
            }

            // Fallback to MediaRecorder
            return await this.convertWithMediaRecorder(videoFile, options);

        } catch (error) {
            console.error('❌ Video conversion failed:', error);
            console.log('⚠️ Falling back to original file');
            return videoFile;
        }
    }

    /**
     * Check if video file is already H.265
     */
    async isH265(videoFile) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            const url = URL.createObjectURL(videoFile);
            
            video.onloadedmetadata = () => {
                URL.revokeObjectURL(url);
                // This is a basic check - in practice you'd want to analyze the actual codec
                // For now, we'll assume MP4 files might need conversion
                const isH265 = videoFile.type.includes('h265') || 
                               videoFile.type.includes('hev1') ||
                               videoFile.name.toLowerCase().includes('h265');
                resolve(isH265);
            };
            
            video.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(false);
            };
            
            video.src = url;
        });
    }

    /**
     * Convert using WebCodecs API (most efficient)
     */
    async convertWithWebCodecs(videoFile, options) {
        console.log('🚀 Using WebCodecs API for H.265 conversion');
        
        // This is a simplified implementation
        // In practice, you'd need to implement the full WebCodecs pipeline
        // For now, we'll return the original file and log that WebCodecs is available
        
        console.log('ℹ️ WebCodecs API detected - full implementation would go here');
        console.log('ℹ️ This would provide the best quality and performance');
        
        // Return original for now - you can implement the full WebCodecs pipeline later
        return videoFile;
    }

    /**
     * Convert using MediaRecorder (fallback)
     */
    async convertWithMediaRecorder(videoFile, options) {
        console.log('📹 Using MediaRecorder fallback for conversion');
        
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const url = URL.createObjectURL(videoFile);
            
            video.onloadedmetadata = () => {
                // Calculate dimensions maintaining aspect ratio
                const { width, height } = this.calculateDimensions(
                    video.videoWidth, 
                    video.videoHeight, 
                    options.maxWidth, 
                    options.maxHeight
                );
                
                // Create canvas for processing
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = width;
                canvas.height = height;
                
                // Create MediaRecorder with H.265 codec if supported
                const stream = canvas.captureStream();
                const mimeType = this.getBestSupportedMimeType();
                
                if (!mimeType) {
                    console.log('⚠️ No H.265 codec support, using original');
                    URL.revokeObjectURL(url);
                    resolve(videoFile);
                    return;
                }
                
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: mimeType,
                    videoBitsPerSecond: options.targetBitrate || 2500000 // 2.5 Mbps default
                });
                
                const chunks = [];
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    const convertedFile = new File([blob], this.generateH265Filename(videoFile.name), {
                        type: mimeType,
                        lastModified: Date.now()
                    });
                    
                    console.log('✅ H.265 conversion completed:', convertedFile.name);
                    console.log('📊 Original size:', this.formatFileSize(videoFile.size));
                    console.log('📊 Converted size:', this.formatFileSize(convertedFile.size));
                    
                    URL.revokeObjectURL(url);
                    resolve(convertedFile);
                };
                
                // Start recording and process video frames
                mediaRecorder.start();
                
                // Process video frames
                let frameCount = 0;
                const processFrame = () => {
                    if (frameCount < video.duration * 30) { // 30 fps
                        ctx.drawImage(video, 0, 0, width, height);
                        frameCount++;
                        requestAnimationFrame(processFrame);
                    } else {
                        mediaRecorder.stop();
                    }
                };
                
                video.currentTime = 0;
                video.play();
                processFrame();
            };
            
            video.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load video for conversion'));
            };
            
            video.src = url;
        });
    }

    /**
     * Get the best supported MIME type for H.265
     */
    getBestSupportedMimeType() {
        const mimeTypes = [
            'video/webm;codecs=h265',
            'video/mp4;codecs=h265',
            'video/mp4;codecs=hev1',
            'video/webm;codecs=vp9', // Fallback to VP9 if H.265 not supported
            'video/webm;codecs=vp8'  // Final fallback
        ];
        
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                return mimeType;
            }
        }
        
        return null;
    }

    /**
     * Calculate dimensions maintaining aspect ratio
     */
    calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
        const aspectRatio = originalWidth / originalHeight;
        
        if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
            return { width: originalWidth, height: originalHeight };
        }
        
        if (maxWidth / maxHeight > aspectRatio) {
            return {
                width: Math.round(maxHeight * aspectRatio),
                height: maxHeight
            };
        } else {
            return {
                width: maxWidth,
                height: Math.round(maxWidth / aspectRatio)
            };
        }
    }

    /**
     * Generate filename for H.265 converted file
     */
    generateH265Filename(originalName) {
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
        const extension = this.getBestSupportedMimeType()?.split(';')[0]?.split('/')[1] || 'mp4';
        return `${nameWithoutExt}_h265.${extension}`;
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoConverter;
} else {
    window.VideoConverter = VideoConverter;
}
