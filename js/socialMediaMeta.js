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
    const baseUrl = window.location.origin;
    
    // Prepare meta tag values
    const title = videoData.title || 'Watch Video - Replay Hub';
    const description = generateVideoDescription(videoData);
    const videoUrl = formatVideoUrlForSocialMedia(videoData.s3_url || '');
    const thumbnailUrl = videoData.thumbnail_url || generateThumbnailUrl(videoData);
    const duration = videoData.duration || '';
    const uploader = videoData.uploader || 'Unknown';
    
    console.log('🏷️ Updating social media meta tags:', {
      title,
      description: description.substring(0, 100) + '...',
      videoUrl: videoUrl.substring(0, 50) + '...',
      thumbnailUrl
    });

    // Update basic meta tags
    updateMetaTag('description', description);
    
    // Update Open Graph meta tags for better WhatsApp/Discord support
    updateMetaProperty('og:type', 'video.other');
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
    updateMetaProperty('og:video:type', 'video/mp4');
    updateMetaProperty('og:video:width', '1280');
    updateMetaProperty('og:video:height', '720');
    
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
    updateMetaName('twitter:player:stream:content_type', 'video/mp4');

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
    // If we have a thumbnail URL, use it
    if (videoData.thumbnail_url) {
      return videoData.thumbnail_url;
    }

    // Try to generate thumbnail from video URL
    if (videoData.s3_url) {
      // For S3 videos, we could potentially generate a thumbnail URL
      // This would require backend support to generate thumbnails
      const videoExtension = videoData.s3_url.split('.').pop().toLowerCase();
      const baseUrl = videoData.s3_url.replace(`.${videoExtension}`, '');
      const possibleThumbnail = `${baseUrl}_thumbnail.jpg`;
      
      // For now, return a placeholder or default image
      // Use a data URI for a simple colored placeholder instead of missing file
      return generatePlaceholderImage(videoData.title || 'Video');
    }

    // Fallback to a default Replay Hub image
    return generatePlaceholderImage('Replay Hub');
  }

  /**
   * Generate a placeholder image using data URI
   * @param {string} text - Text to display on the placeholder
   * @returns {string} Data URI for placeholder image
   */
  function generatePlaceholderImage(text) {
    // Create a simple SVG placeholder with the text
    const svg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#4ecdc4;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
        <circle cx="600" cy="250" r="80" fill="rgba(255,255,255,0.2)"/>
        <polygon points="580,230 580,270 620,250" fill="white"/>
        <text x="600" y="380" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle" fill="white">${text}</text>
        <text x="600" y="420" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="rgba(255,255,255,0.8)">Watch on Replay Hub</text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
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
    const baseUrl = window.location.origin;
    const currentPath = window.location.pathname;
    
    // Use the current URL parameters to maintain context
    const urlParams = new URLSearchParams(window.location.search);
    
    return `${baseUrl}${currentPath}?${urlParams.toString()}`;
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
    const defaultThumbnail = generatePlaceholderImage('Replay Hub');
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
  async function copyVideoLink() {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);
      
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
      textArea.value = window.location.href;
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
    updateCanonicalUrl
  };

  // Initialize default meta tags when module loads
  initializeDefaultMetaTags();

  console.log('✅ Social Media Meta module loaded');

})(); 