/**
 * Social Media Meta Tags Manager for Replay Hub
 * Dynamically updates Open Graph and Twitter Card meta tags for video sharing
 */

// Initialize the global replayHub object if needed
window.replayHub = window.replayHub || {};

(function() {
  /**
   * Update all social media meta tags for a video
   * @param {Object} videoData - Video metadata object
   * @param {string} videoData.title - Video title
   * @param {string} videoData.description - Video description
   * @param {string} videoData.s3_url - Video URL
   * @param {string} videoData.uploader - Video uploader name
   * @param {string} videoData.thumbnail_url - Video thumbnail URL (optional)
   * @param {number} videoData.duration - Video duration in seconds (optional)
   * @param {Object} videoData.players - Array of player names (optional)
   */
  function updateVideoMetaTags(videoData) {
    if (!videoData) {
      console.warn('No video data provided for meta tag updates');
      return;
    }

    const currentUrl = window.location.href;
    
    // Prepare meta tag values
    const title = videoData.title || 'Watch Video - Replay Hub';
    const description = generateVideoDescription(videoData);
    const directMp4 = /\.(mp4|m4v)(?:[?#]|$)/i.test(videoData.s3_url || '');
    const videoUrl = videoData.inline_video_url ?? (directMp4 ? videoData.s3_url : '');
    const videoType = videoData.inline_video_type || (videoUrl ? 'video/mp4' : '');
    const size = /^(\d+)\s*[xX×]\s*(\d+)$/.exec(videoData.resolution || '');
    const thumbnailUrl = videoData.thumbnail_url || generateThumbnailUrl(videoData);
    const duration = videoData.duration || '';
    
    console.log('🏷️ Updating social media meta tags:', {
      title,
      description: description.substring(0, 100) + '...',
      videoUrl: videoUrl.substring(0, 50) + '...',
      thumbnailUrl
    });

    // Update basic meta tags
    updateMetaTag('description', description);
    
    // Update Open Graph meta tags for better WhatsApp/Discord support
    updateMetaProperty('og:type', videoUrl ? 'video.other' : 'website');
    updateMetaProperty('og:site_name', 'Replay Hub');
    updateMetaProperty('og:title', title);
    updateMetaProperty('og:description', description);
    updateMetaProperty('og:url', currentUrl);
    updateMetaProperty('og:image', thumbnailUrl);
    updateMetaProperty('og:image:width', '1200');
    updateMetaProperty('og:image:height', '630');
    updateMetaProperty('og:image:alt', `${title} - Video thumbnail`);
    
    // Video-specific Open Graph tags
    updateMetaProperty('og:video', videoUrl);
    updateMetaProperty('og:video:url', videoUrl);
    updateMetaProperty('og:video:secure_url', videoUrl);
    updateMetaProperty('og:video:type', videoType);
    updateMetaProperty('og:video:width', size?.[1] || '1280');
    updateMetaProperty('og:video:height', size?.[2] || '720');
    
    if (duration) {
      updateMetaProperty('og:video:duration', duration.toString());
    }

    // Twitter Card meta tags
    updateMetaName('twitter:card', 'player');
    updateMetaName('twitter:site', '@ReplayHub');
    updateMetaName('twitter:creator', '@ReplayHub');
    updateMetaName('twitter:title', title);
    updateMetaName('twitter:description', description);
    updateMetaName('twitter:image', thumbnailUrl);
    updateMetaName('twitter:image:alt', `${title} - Video thumbnail`);
    updateMetaName('twitter:player', currentUrl);
    updateMetaName('twitter:player:width', '1280');
    updateMetaName('twitter:player:height', '720');
    updateMetaName('twitter:player:stream', videoUrl);
    updateMetaName('twitter:player:stream:content_type', videoType);

    // Discord-specific meta tags
    updateMetaName('theme-color', '#ff6b6b');
    
    // Additional meta tags for better social media support
    updateMetaProperty('og:locale', 'en_US');
    updateMetaProperty('og:updated_time', new Date().toISOString());
    
    // Update canonical URL
    updateCanonicalUrl(currentUrl);

    // Update page title
    document.title = `${title} - Replay Hub`;

    console.log('✅ Social media meta tags updated successfully');
  }

  /**
   * Generate a descriptive description for the video
   * @param {Object} videoData - Video metadata
   * @returns {string} Generated description
   */
  function generateVideoDescription(videoData) {
    let description = '';
    
    if (videoData.description) {
      description = videoData.description;
    } else {
      // Generate description from available data
      description = 'Watch this amazing replay';
      
      if (videoData.uploader) {
        description += ` by ${videoData.uploader}`;
      }
      
      if (videoData.players && videoData.players.length > 0) {
        const playerNames = Array.isArray(videoData.players) 
          ? videoData.players.join(', ')
          : videoData.players;
        description += ` featuring ${playerNames}`;
      }
      
      description += ' on Replay Hub';
    }

    // Ensure description isn't too long for social media
    if (description.length > 300) {
      description = description.substring(0, 297) + '...';
    }

    return description;
  }

  /**
   * Generate a thumbnail URL for the video
   * @param {Object} videoData - Video metadata
   * @returns {string} Thumbnail URL
   */
  function generateThumbnailUrl(videoData) {
    const api = window.BASE_URL || 'https://replay-hub.theclusterflux.com';
    if (videoData.thumbnail_url) return videoData.thumbnail_url;
    if (videoData.thumbnail_id) return `${api}/thumbnail/${encodeURIComponent(videoData.thumbnail_id)}`;
    return videoData.poster_url || `${api}/static/replay-poster.png`;
  }

  /**
   * Update a meta tag with name attribute
   * @param {string} name - Meta tag name
   * @param {string} content - Meta tag content
   */
  function updateMetaName(name, content) {
    if (!content) return;
    
    let metaTag = document.querySelector(`meta[name="${name}"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', name);
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', content);
  }

  /**
   * Update a meta tag with property attribute
   * @param {string} property - Meta tag property
   * @param {string} content - Meta tag content
   */
  function updateMetaProperty(property, content) {
    if (!content) return;
    
    let metaTag = document.querySelector(`meta[property="${property}"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('property', property);
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', content);
  }

  /**
   * Update a meta tag with name attribute (for description, keywords, etc.)
   * @param {string} name - Meta tag name
   * @param {string} content - Meta tag content
   */
  function updateMetaTag(name, content) {
    if (!content) return;
    
    let metaTag = document.querySelector(`meta[name="${name}"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', name);
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', content);
  }

  /**
   * Update the canonical URL
   * @param {string} url - Canonical URL
   */
  function updateCanonicalUrl(url) {
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
      canonicalTag = document.createElement('link');
      canonicalTag.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalTag);
    }
    canonicalTag.setAttribute('href', url);
  }

  /**
   * Generate a shareable URL for the video
   * @param {Object} videoData - Video metadata
   * @returns {string} Shareable URL
   */
  function generateShareableUrl(videoData) {
    const params = new URLSearchParams(location.search);
    const id = videoData?.short_id || videoData?.id || params.get('id');
    if (!id || params.has('s3_url')) return location.href;
    const shareOrigin = location.hostname === 'replayhub.theclusterflux.com'
      ? location.origin
      : window.BASE_URL || 'https://replay-hub.theclusterflux.com';
    const url = new URL('/share', shareOrigin);
    url.searchParams.set('id', id);
    return url.href;
  }

  /**
   * Validate and format video URL for social media compatibility
   * @param {string} videoUrl - The video URL to validate
   * @returns {string} Formatted video URL
   */
  function formatVideoUrlForSocialMedia(videoUrl) {
    if (!videoUrl) return '';
    
    try {
      // Ensure URL is properly encoded
      const url = new URL(videoUrl);
      
      // For S3 URLs, ensure they're accessible to social media crawlers
      if (url.hostname.includes('s3.amazonaws.com') || url.hostname.includes('.s3.')) {
        // Check if URL has proper parameters for public access
        if (!url.searchParams.has('X-Amz-Signature')) {
          // If no signature, it might be a public URL
          return videoUrl;
        } else {
          // For signed URLs, we might need to create a proxy or use a different approach
          console.warn('Signed S3 URL detected - may not work with social media crawlers');
          return videoUrl;
        }
      }
      
      return videoUrl;
    } catch (error) {
      console.warn('Invalid video URL for social media:', error);
      return videoUrl;
    }
  }

  /**
   * Get structured data for the video (JSON-LD)
   * @param {Object} videoData - Video metadata
   * @returns {Object} Structured data object
   */
  function generateStructuredData(videoData) {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": videoData.title || "Video",
      "description": generateVideoDescription(videoData),
      "thumbnailUrl": generateThumbnailUrl(videoData),
      "uploadDate": videoData.created_at || new Date().toISOString(),
      "contentUrl": videoData.s3_url || "",
      "embedUrl": window.location.href,
      "publisher": {
        "@type": "Organization",
        "name": "Replay Hub",
        "url": window.location.origin
      }
    };

    if (videoData.uploader) {
      structuredData.author = {
        "@type": "Person",
        "name": videoData.uploader
      };
    }

    if (videoData.duration) {
      // Convert duration to ISO 8601 format (PT#S)
      structuredData.duration = `PT${videoData.duration}S`;
    }

    return structuredData;
  }

  /**
   * Add structured data script to page
   * @param {Object} videoData - Video metadata
   */
  function addStructuredData(videoData) {
    // Remove existing structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const structuredData = generateStructuredData(videoData);
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData, null, 2);
    document.head.appendChild(script);

    console.log('📊 Added structured data for SEO:', structuredData);
  }

  /**
   * Initialize social media meta tags with default values
   */
  function initializeDefaultMetaTags() {
    const currentUrl = window.location.href;
    
    // Set basic fallback values
    updateMetaProperty('og:url', currentUrl);
    updateMetaName('twitter:player', currentUrl);
    updateCanonicalUrl(currentUrl);
    
    // Set a default placeholder image immediately
    const defaultThumbnail = generateThumbnailUrl({});
    updateMetaProperty('og:image', defaultThumbnail);
    updateMetaName('twitter:image', defaultThumbnail);
    
    // Set updated time
    updateMetaProperty('og:updated_time', new Date().toISOString());
    
    console.log('🏷️ Initialized default social media meta tags');
  }

  /**
   * Copy video link to clipboard for sharing
   * @returns {Promise<boolean>} Success status
   */
  async function copyVideoLink(url = generateShareableUrl()) {
    try {
      await navigator.clipboard.writeText(url);
      
      // Show a brief success message
      console.log('📋 Video link copied to clipboard');
      
      // You could add a toast notification here
      if (window.replayHub && window.replayHub.utils && window.replayHub.utils.showToast) {
        window.replayHub.utils.showToast('Video link copied to clipboard!', 'success');
      }
      
      return true;
    } catch (error) {
      console.error('Failed to copy video link:', error);
      
      // Fallback to manual selection for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return true;
    }
  }

  /**
   * Debug function to check current meta tags
   * @returns {Object} Current meta tag values
   */
  function debugMetaTags() {
    const metaTags = {};
    
    // Check Open Graph tags
    const ogTags = document.querySelectorAll('meta[property^="og:"]');
    ogTags.forEach(tag => {
      metaTags[tag.getAttribute('property')] = tag.getAttribute('content');
    });
    
    // Check Twitter tags
    const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
    twitterTags.forEach(tag => {
      metaTags[tag.getAttribute('name')] = tag.getAttribute('content');
    });
    
    console.log('🔍 Current meta tags:', metaTags);
    return metaTags;
  }

  // Export functions to the global replayHub object
  window.replayHub.socialMediaMeta = {
    updateVideoMetaTags,
    initializeDefaultMetaTags,
    generateShareableUrl,
    addStructuredData,
    copyVideoLink,
    debugMetaTags,
    formatVideoUrlForSocialMedia,
    updateMetaProperty,
    updateMetaName,
    updateCanonicalUrl,
    generateThumbnailUrl
  };

  // Initialize default meta tags when module loads
  initializeDefaultMetaTags();

  console.log('✅ Social Media Meta module loaded');

})();
