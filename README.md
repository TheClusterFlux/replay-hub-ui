# Replay Hub UI

![Replay Hub Logo](https://img.shields.io/badge/Replay-Hub-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)

## Overview

Replay Hub is a modern web application that allows gamers to upload, share, and discover gameplay video clips. The platform features an intuitive interface for browsing videos, robust upload capabilities including both single and bulk uploads, and integrated metadata for enhanced searchability.

## Features

### For Viewers
- **Browse Video Gallery**: Explore gaming videos in a responsive grid layout
- **Search Functionality**: Find videos by title, description, uploader, or featured players
- **Video Player**: Watch videos with standard playback controls
- **View Tracking**: Automatic view count tracking to show popularity
- **Sorting Options**: Sort videos by popularity, upload date, or duration

### For Content Creators
- **Single Video Upload**: Upload individual gameplay clips with detailed metadata
- **Bulk Upload**: Submit multiple videos at once for efficient sharing
- **Custom Metadata**: Add rich information to videos:
  - Username attribution
  - Player listings (who appears in the clip)
  - Detailed descriptions
- **Upload Progress Tracking**: Real-time progress bar for upload status
- **Large File Support**: Handles videos up to 10GB with chunked uploading

## Tech Stack

- **Frontend**: Pure JavaScript, HTML5, CSS3
- **Video Processing**: Native browser APIs for video processing
- **File Handling**: Modern File API with drag-and-drop support
- **Backend Communication**: RESTful API calls to Replay Hub backend service
- **Asset Storage**: Content delivery via AWS S3 (or local storage in development)

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Replay Hub backend service running (see [Replay Hub Backend](https://github.com/TheClusterFlux/replay-hub))

### Local Development
1. Clone the repository:
```bash
git clone https://github.com/TheClusterFlux/replay-hub-ui.git
cd replay-hub-ui
```

2. Open the project in a local development server:
```bash
# Using Python's built-in server
python -m http.server 8000
# OR using Node's http-server (requires npm install -g http-server)
http-server
```

3. Access the application:
```
http://localhost:8000/
```

### Configuration
The application can be configured to work with different backend environments by updating the `ISLOCAL` constant in `app.js`:

```javascript
const ISLOCAL = true;  // For local backend development
const BASE_URL = ISLOCAL ? 'http://localhost:8080' : 'https://replay-hub.theclusterflux.com';
```
