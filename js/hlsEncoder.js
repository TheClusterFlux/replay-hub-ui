/**
 * Client-side HLS encoding via @ffmpeg/ffmpeg (WebAssembly).
 * Requires COOP/COEP headers on the page for multi-threaded performance.
 */

const LADDER = [
  { name: '480p', height: 480 },
  { name: '720p', height: 720 },
  { name: '1080p', height: 1080 },
];

let ffmpegInstance = null;
let loadPromise = null;

async function loadFfmpeg(onLog) {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { FFmpeg } = await import(
      'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/+esm'
    );
    const { fetchFile, toBlobURL } = await import(
      'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/+esm'
    );

    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
      if (onLog) onLog(message);
    });
    ffmpeg.on('progress', ({ progress, time }) => {
      if (onLog && progress > 0) {
        onLog(`progress ${(progress * 100).toFixed(1)}% time=${time}`);
      }
    });

    const coreVersion = '0.12.6';
    const base = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${coreVersion}/dist/esm`;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = { ffmpeg, fetchFile };
    return ffmpegInstance;
  })();

  return loadPromise;
}

function extOf(filename) {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i) : '.mp4';
}

async function readOutputFiles(ffmpeg, dir = '.') {
  const out = [];
  const entries = await ffmpeg.listDir(dir);
  for (const entry of entries) {
    if (entry.isDir && entry.name !== '.' && entry.name !== '..') {
      const sub = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      out.push(...(await readOutputFiles(ffmpeg, sub)));
    } else if (!entry.isDir && entry.name !== '.' && entry.name !== '..') {
      const path = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      const data = await ffmpeg.readFile(path);
      const blob = new Blob([data.buffer], {
        type: guessMime(path),
      });
      out.push({ path, blob });
    }
  }
  return out;
}

function guessMime(path) {
  if (path.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (path.endsWith('.ts')) return 'video/mp2t';
  if (path.endsWith('.mp4')) return 'video/mp4';
  if (path.endsWith('.jpg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function buildMasterPlaylist(variants) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  const bandwidths = { '480p': 1128000, '720p': 2628000, '1080p': 5192000 };
  for (const name of variants) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidths[name] || 2000000}`);
    lines.push(`${name}/index.m3u8`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Encode a video file to an HLS bundle in the browser.
 * @param {File} file
 * @param {(phase: string, pct: number) => void} onProgress
 * @returns {Promise<{files: {path: string, blob: Blob}[], duration: number, resolution: string}>}
 */
export async function encodeVideoToHls(file, onProgress) {
  const report = (phase, pct) => {
    if (onProgress) onProgress(phase, pct);
  };

  report('Loading encoder', 2);
  const { ffmpeg, fetchFile } = await loadFfmpeg((msg) => console.debug('[ffmpeg]', msg));

  const inputName = `input${extOf(file.name)}`;
  report('Reading source video', 5);
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const applicable = LADDER;
  const doneVariants = [];
  let step = 0;
  const encodeSteps = applicable.length + 2;

  for (const { name, height } of applicable) {
    step += 1;
    report(`Encoding ${name}`, 5 + Math.round((step / encodeSteps) * 75));
    await ffmpeg.createDir(name).catch(() => {});
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', `scale=-2:${height}`,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
      '-hls_time', '4',
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', `${name}/seg_%05d.ts`,
      `${name}/index.m3u8`,
    ]);
    doneVariants.push(name);
  }

  step += 1;
  report('Creating poster', 5 + Math.round((step / encodeSteps) * 75));
  await ffmpeg.exec([
    '-ss', '1', '-i', inputName,
    '-vframes', '1', '-q:v', '2',
    'poster.jpg',
  ]);

  step += 1;
  report('Preserving original', 5 + Math.round((step / encodeSteps) * 75));
  await ffmpeg.exec(['-i', inputName, '-c', 'copy', 'original.mp4']);

  const masterText = buildMasterPlaylist(doneVariants);
  await ffmpeg.writeFile('master.m3u8', new TextEncoder().encode(masterText));

  report('Collecting files', 88);
  const files = await readOutputFiles(ffmpeg);

  report('Done', 100);
  return {
    files,
    duration: 0,
    resolution: doneVariants[doneVariants.length - 1] || '720p',
  };
}

export function isClientEncodingSupported() {
  return typeof WebAssembly !== 'undefined';
}
