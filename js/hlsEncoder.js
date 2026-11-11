/**
 * Client-side HLS encoding via @ffmpeg/ffmpeg (WebAssembly).
 * Requires COOP/COEP headers on the page for multi-threaded performance.
 */

const LADDER = [
  { name: '480p', height: 480 },
  { name: '720p', height: 720 },
  { name: '1080p', height: 1080 },
];

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
  const controller = new AbortController();
  let idleTimer, runtimeTimer, expire;
  const deadline = new Promise((_, reject) => {
    expire = () => {
      reject(new Error('Browser encoding timed out'));
      controller.abort();
    };
    runtimeTimer = setTimeout(expire, 15 * 60_000);
  });
  const active = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(expire, 90_000);
  };
  try {
    return await Promise.race([encode(file, onProgress, controller.signal, active), deadline]);
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(runtimeTimer);
  }
}

async function encode(file, onProgress, signal, active) {
  const report = (phase, pct) => {
    active();
    if (onProgress) onProgress(phase, pct);
  };

  report('Loading encoder', 2);
  const ffmpegBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm';
  const coreBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
  const { FFmpeg } = await import(`${ffmpegBase}/index.js`);
  if (signal.aborted) throw new Error('Browser encoding timed out');
  const ffmpeg = new FFmpeg();
  const terminate = () => ffmpeg.terminate();
  signal.addEventListener('abort', terminate, { once: true });
  ffmpeg.on('progress', active);
  const workerURL = URL.createObjectURL(new Blob(
    [`import '${ffmpegBase}/worker.js';`], { type: 'text/javascript' }
  ));
  const exec = async (args, phase) => {
    if (await ffmpeg.exec(args) !== 0) throw new Error(`${phase} failed for ${file.name}`);
  };
  try {
    await ffmpeg.load({
      classWorkerURL: workerURL,
      coreURL: `${coreBase}/ffmpeg-core.js`,
      wasmURL: `${coreBase}/ffmpeg-core.wasm`,
    });
    const input = 'input';
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    let width, height;
    const readSize = ({ message }) => {
      const size = message.match(/Video:.*?\b(\d{2,5})x(\d{2,5})\b/);
      if (size && !height) [, width, height] = size.map(Number);
    };
    ffmpeg.on('log', readSize);
    await exec(['-i', input, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'], 'Reading video');
    ffmpeg.off('log', readSize);
    const variants = LADDER.filter(level => !height || level.height <= height);
    if (!variants.length) variants.push(LADDER[0]);

    const files = [];
    const collect = async (path) => {
      const bytes = await ffmpeg.readFile(path);
      if (!bytes.length) throw new Error(`Empty encoder output: ${path}`);
      files.push({ path, blob: new Blob([bytes], { type: guessMime(path) }) });
      await ffmpeg.deleteFile(path);
    };
    let duration = 0;
    for (const [i, level] of variants.entries()) {
      const dir = level.name;
      report(`Encoding ${dir}`, 8 + 70 * i / variants.length);
      await ffmpeg.createDir(dir);
      await exec(['-i', input, '-vf', `scale=-2:min(${level.height}\\,max(2\\,trunc(ih/2)*2))`,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-crf', '23',
        '-force_key_frames', 'expr:gte(t,n_forced*4)', '-c:a', 'aac', '-ac', '2',
        '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments',
        '-hls_segment_filename', `${dir}/seg_%05d.ts`, `${dir}/index.m3u8`], `Encoding ${dir}`);
      if (!duration) {
        const playlist = await ffmpeg.readFile(`${dir}/index.m3u8`, 'utf8');
        duration = Array.from(playlist.matchAll(/#EXTINF:([\d.]+)/g))
          .reduce((total, match) => total + Number(match[1]), 0);
      }
      for (const entry of await ffmpeg.listDir(dir)) {
        if (!entry.isDir) await collect(`${dir}/${entry.name}`);
      }
    }
    report('Creating poster', 82);
    await exec(['-i', input, '-frames:v', '1', '-q:v', '2', 'poster.jpg'], 'Creating poster');
    await collect('poster.jpg');
    report('Preparing download', 90);
    if (await ffmpeg.exec(['-i', input, '-c', 'copy', 'original.mp4']) !== 0) {
      await exec(['-y', '-i', input, '-c:v', 'libx264', '-preset', 'ultrafast',
        '-c:a', 'aac', 'original.mp4'], 'Preparing MP4 download');
    }
    await collect('original.mp4');
    const master = buildMasterPlaylist(variants.map(level => level.name));
    files.push({ path: 'master.m3u8', blob: new Blob([master], { type: guessMime('master.m3u8') }) });
    report('Done', 100);
    return { files, duration, resolution: width && height ? `${width}x${height}` : '' };
  } finally {
    signal.removeEventListener('abort', terminate);
    ffmpeg.terminate();
    URL.revokeObjectURL(workerURL);
  }
}

export function isClientEncodingSupported() {
  return typeof WebAssembly !== 'undefined';
}
