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
    const videoUrl = videoData.s3_url || '';
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
    
    // Update Open Graph meta tags
    updateMetaProperty('og:title', title);
    updateMetaProperty('og:description', description);
    updateMetaProperty('og:url', currentUrl);
    updateMetaProperty('og:image', thumbnailUrl);
    updateMetaProperty('og:video', videoUrl);
    updateMetaProperty('og:video:url', videoUrl);
    updateMetaProperty('og:video:secure_url', videoUrl);
    
    if (duration) {
      updateMetaProperty('og:video:duration', duration.toString());
    }

    // Update Twitter Card meta tags
    updateMetaName('twitter:title', title);
    updateMetaName('twitter:description', description);
    updateMetaName('twitter:image', thumbnailUrl);
    updateMetaName('twitter:player', currentUrl);
    updateMetaName('twitter:player:stream', videoUrl);

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
      return `${window.location.origin}/images/video-placeholder.jpg`;
    }

    // Fallback to a default Replay Hub image
    return `${window.location.origin}/images/replay-hub-logo.jpg`;
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

  // Export functions to the global replayHub object
  window.replayHub.socialMediaMeta = {
    updateVideoMetaTags,
    initializeDefaultMetaTags,
    generateShareableUrl,
    addStructuredData,
    copyVideoLink
  };

  // Initialize default meta tags when module loads
  initializeDefaultMetaTags();

  console.log('✅ Social Media Meta module loaded');

})(); 