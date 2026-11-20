window.replayHub = window.replayHub || {};

window.replayHub.images = (() => {
    function spinner() {
        const element = document.createElement('span');
        element.className = 'image-spinner';
        element.setAttribute('aria-hidden', 'true');
        return element;
    }

    function replaySources(video, baseUrl) {
        const thumbnail = video.thumbnail_id && baseUrl + '/thumbnail/' + encodeURIComponent(video.thumbnail_id);
        const poster = video.poster_url || (video.storage_prefix && video.id &&
            baseUrl + '/stream/' + encodeURIComponent(video.id) + '/poster.jpg');
        return [...new Set([thumbnail, poster].filter(Boolean))];
    }

    async function load(sources, anonymous = false) {
        for (const src of sources) {
            const image = new Image();
            image.alt = '';
            image.decoding = 'async';
            if (anonymous) image.crossOrigin = 'anonymous';
            try {
                if (image.decode) {
                    image.src = src;
                    await image.decode();
                } else {
                    await new Promise((resolve, reject) => {
                        image.onload = resolve;
                        image.onerror = reject;
                        image.src = src;
                    });
                }
                return image;
            } catch {
                // The next source may still have a usable preview.
            }
        }
        return null;
    }

    return { spinner, replaySources, load };
})();
