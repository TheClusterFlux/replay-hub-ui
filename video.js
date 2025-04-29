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

function showError(message) {
    const main = document.querySelector('main') || document.querySelector('.video-container');
    if (main) {
        main.innerHTML = `
            <div class="error-message">
                <h2>Error</h2>
                <p>${message}</p>
                <a href="index.html">Back to Home</a>
            </div>
        `;
    } else {
        alert(message);
    }
}

function initVideoPlayer(videoUrl) {
    const videoPlayer = document.getElementById('video-player');
    const videoEmbed = document.getElementById('video-embed');
    
    if (!videoPlayer || !videoEmbed) {
        console.error("Video player elements not found in the DOM");
        return;
    }
    
    // Validate URL
    if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim() === '') {
        showError('Invalid video URL');
        return;
    }
    
    // Ensure video URL is properly encoded
    try {
        const decodedUrl = decodeURIComponent(videoUrl);
        // Encode the URL properly but preserve any existing URL structure
        videoUrl = encodeURI(decodedUrl);
    } catch (e) {
        console.warn('Error processing video URL:', e);
        // Continue with the original URL if there's an error
    }
    
    // Check if this is an HLS stream (.m3u8 extension) or we should try to use streaming anyway
    const isHlsStream = videoUrl.toLowerCase().includes('.m3u8');
    const videoType = detectVideoType(videoUrl);
    
    try {
        if (window.videojs) {
            // Ensure any previous instance is disposed
            const existingPlayer = window.videojs.getPlayer('video-player');
            if (existingPlayer) {
                existingPlayer.dispose();
            }
            
            // Initialize VideoJS with extended options
            const player = window.videojs('video-player', {
                controls: true,
                preload: 'auto',
                fluid: true,
                responsive: true,
                html5: {
                    vhs: {
                        overrideNative: true,
                        enableLowInitialPlaylist: true
                    },
                    nativeAudioTracks: false,
                    nativeVideoTracks: false
                },
                playbackRates: [0.5, 1, 1.5, 2],
                controlBar: {
                    children: [
                        'playToggle',
                        'volumePanel',
                        'currentTimeDisplay',
                        'timeDivider',
                        'durationDisplay',
                        'progressControl',
                        'playbackRateMenuButton',
                        'qualitySelector', // For quality selection if available
                        'fullscreenToggle'
                    ]
                }
            });
            
            // For direct AWS S3 URLs, let's try to leverage streaming capabilities
            if (isHlsStream) {
                console.log('Detected HLS stream, using HLS.js');
                setupHlsStream(player, videoUrl);
            } else {
                // Determine if we can use HLS.js for better streaming or fallback to native
                setupAdaptiveStreaming(player, videoUrl, videoType);
            }
            
            // Handle error and fall back to iframe if needed
            player.on('error', function() {
                console.warn('Video.js playback failed, falling back to iframe');
                fallbackToIframe(videoUrl, videoPlayer, videoEmbed);
            });
        } else {
            // Fallback if Video.js isn't available
            console.warn('Video.js not available, falling back to native player');
            videoPlayer.style.display = 'block';
            videoEmbed.style.display = 'none';
            
            // Use native video player
            videoPlayer.src = videoUrl;
            
            videoPlayer.onerror = () => {
                console.warn('Native video playback failed, falling back to iframe');
                fallbackToIframe(videoUrl, videoPlayer, videoEmbed);
            };
        }
    } catch (err) {
        console.error('Error setting up video player:', err);
        fallbackToIframe(videoUrl, videoPlayer, videoEmbed);
    }
}

function setupHlsStream(player, videoUrl) {
    if (window.Hls) {
        if (Hls.isSupported()) {
            const hls = new Hls({
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                maxBufferSize: 60 * 1000 * 1000, // 60MB
                startLevel: -1, // Auto-select initial quality
                debug: false
            });
            
            hls.loadSource(videoUrl);
            hls.attachMedia(player.tech().el());
            
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                player.play(); // Autoplay if desired
            });
            
            // Handle HLS.js errors
            hls.on(Hls.Events.ERROR, function(event, data) {
                if (data.fatal) {
                    switch(data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('HLS network error:', data);
                            hls.startLoad(); // Try to recover
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('HLS media error:', data);
                            hls.recoverMediaError(); // Try to recover
                            break;
                        default:
                            console.error('Fatal HLS error:', data);
                            // Destroy HLS instance and fallback
                            hls.destroy();
                            player.src({
                                src: videoUrl,
                                type: detectVideoType(videoUrl)
                            });
                            break;
                    }
                }
            });
            
            // Store HLS instance for cleanup
            player.on('dispose', function() {
                if (hls) {
                    hls.destroy();
                }
            });
        } else {
            // HLS.js not supported, try native HLS
            player.src({
                src: videoUrl,
                type: 'application/x-mpegURL'
            });
        }
    } else {
        // HLS.js not loaded, try native HLS
        player.src({
            src: videoUrl,
            type: 'application/x-mpegURL'
        });
    }
}

function setupAdaptiveStreaming(player, videoUrl, videoType) {
    // Check if the URL is from S3 and if we can apply streaming optimizations
    const isS3Url = videoUrl.includes('s3.') && videoUrl.includes('amazonaws.com');
    
    if (isS3Url) {
        // For S3 URLs, we can try to use Range requests for better streaming
        // Unfortunately we can't directly convert to HLS without server-side processing
        // But we can optimize the video loading
        
        // Set source with appropriate MIME type for streaming
        player.src({
            src: videoUrl,
            type: videoType
        });
        
        // Configure player for better streaming experience
        player.buffered = true; // Enable buffering
        player.preload = 'auto'; // Start preloading
        
        // Add event listener to monitor buffering
        player.on('waiting', function() {
            console.log('Video is buffering...');
            // You could add a buffering indicator here
        });
        
        // Add event listener to monitor progress
        player.on('progress', function() {
            // Monitor buffering progress
        });
    } else {
        // Regular direct source
        player.src({
            src: videoUrl,
            type: videoType
        });
    }
}

function fallbackToIframe(videoUrl, videoPlayer, videoEmbed) {
    if (videoPlayer) videoPlayer.style.display = 'none';
    if (videoEmbed) {
        videoEmbed.style.display = 'block';
        videoEmbed.src = videoUrl;
    }
}

function detectVideoType(url) {
    if (!url) return 'video/mp4'; // Default
    
    try {
        if (url.toLowerCase().includes('.m3u8')) {
            return 'application/x-mpegURL'; // HLS stream
        }
        
        if (url.toLowerCase().includes('.mpd')) {
            return 'application/dash+xml'; // DASH stream
        }
        
        const extension = url.split('.').pop().toLowerCase().split('?')[0];
        switch (extension) {
            case 'mp4': return 'video/mp4';
            case 'webm': return 'video/webm';
            case 'ogv': return 'video/ogg';
            case 'mov': return 'video/quicktime';
            case 'avi': return 'video/x-msvideo';
            case 'wmv': return 'video/x-ms-wmv';
            case 'flv': return 'video/x-flv';
            case 'mkv': return 'video/x-matroska';
            default: return 'video/mp4'; // Default to mp4
        }
    } catch (e) {
        console.warn('Error detecting video type:', e);
        return 'video/mp4'; // Default to mp4
    }
}