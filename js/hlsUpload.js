/**
 * Client-side HLS upload: encode in browser → presigned PUT → complete.
 */

import { encodeVideoToHls, isClientEncodingSupported } from './hlsEncoder.js';

const BASE_URL = window.BASE_URL || 'http://localhost:8080';

let cachedConfig = null;

export async function fetchAppConfig() {
  if (cachedConfig) return cachedConfig;
  const res = await fetch(`${BASE_URL}/api/config`);
  if (!res.ok) throw new Error('Failed to load app config');
  cachedConfig = await res.json();
  return cachedConfig;
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token =
    localStorage.getItem('replay_hub_token') ||
    sessionStorage.getItem('replay_hub_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function guessMime(path) {
  if (path.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (path.endsWith('.ts')) return 'video/mp2t';
  if (path.endsWith('.mp4')) return 'video/mp4';
  if (path.endsWith('.jpg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function presignUploads(videoId, files) {
  const body = {
    video_id: videoId,
    files: files.map((f) => ({
      path: f.path,
      content_type: guessMime(f.path),
    })),
  };
  const res = await fetch(`${BASE_URL}/upload/hls/presign`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Presign failed (${res.status})`);
  }
  return res.json();
}

async function putFile(url, blob, contentType, onChunkProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onChunkProgress) {
        onChunkProgress(e.loaded / e.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`PUT failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error during PUT'));
    xhr.send(blob);
  });
}

async function completeUpload(videoId, meta) {
  const res = await fetch(`${BASE_URL}/upload/hls/complete`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      video_id: videoId,
      title: meta.title,
      description: meta.description,
      uploader: meta.uploader,
      players: meta.players,
      duration: meta.duration || 0,
      resolution: meta.resolution || '',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Complete failed (${res.status})`);
  }
  return res.json();
}

/**
 * Full client-side HLS upload pipeline.
 */
export async function uploadHlsVideo(file, meta, progressCallback) {
  if (!isClientEncodingSupported()) {
    throw new Error('WebAssembly is not supported in this browser.');
  }

  const config = await fetchAppConfig();
  if (!config.storage_ready) {
    console.warn(
      'R2 storage is not configured on the server. Upload may fail until credentials are set.'
    );
  }

  const videoId = crypto.randomUUID();
  const report = (phase, pct) => {
    if (progressCallback) progressCallback({ phase, percent: pct });
  };

  report('Encoding video (this may take a while)', 0);
  const encoded = await encodeVideoToHls(file, (phase, pct) => {
    report(phase, pct * 0.55);
  });

  report('Requesting upload URLs', 56);
  const presign = await presignUploads(videoId, encoded.files);

  const uploadMap = new Map(
    presign.uploads.map((u) => [u.path, u])
  );

  let uploaded = 0;
  const total = encoded.files.length;

  for (const { path, blob } of encoded.files) {
    const info = uploadMap.get(path);
    if (!info) throw new Error(`No presigned URL for ${path}`);

    await putFile(
      info.upload_url,
      blob,
      info.content_type,
      (p) => {
        const base = 56 + ((uploaded + p) / total) * 40;
        report(`Uploading ${path}`, base);
      }
    );
    uploaded += 1;
    report(`Uploaded ${path}`, 56 + (uploaded / total) * 40);
  }

  report('Finalizing', 98);
  const result = await completeUpload(videoId, {
    ...meta,
    duration: encoded.duration,
    resolution: encoded.resolution,
  });

  report('Complete', 100);
  return result;
}
