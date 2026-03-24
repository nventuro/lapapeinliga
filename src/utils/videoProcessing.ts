/**
 * Extract the first frame of a video as a JPEG blob (for thumbnails).
 */
export function extractFirstFrame(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement('canvas');

    video.onloadeddata = () => {
      video.currentTime = 0.01; // Seek slightly past start to ensure a frame is available
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(video.src);
          if (blob) resolve(blob);
          else reject(new Error('Failed to create thumbnail blob'));
        },
        'image/jpeg',
        0.85,
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video'));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Create a boomerang video (forward + reverse) from a trimmed segment.
 * Returns a WebM blob encoded via MediaRecorder + canvas frame playback.
 */
export async function createBoomerang(
  file: File,
  startTime: number,
  endTime: number,
  fps: number = 15,
): Promise<Blob> {
  // Step 1: Extract frames between startTime and endTime
  const frames = await extractFrames(file, startTime, endTime, fps);
  if (frames.length === 0) throw new Error('No frames extracted');

  // Step 2: Create forward + reverse sequence
  const reversed = [...frames].reverse().slice(1); // Skip last frame to avoid double-frame at reversal
  const boomerangFrames = [...frames, ...reversed];

  // Step 3: Encode to video via canvas + MediaRecorder
  return encodeFrames(boomerangFrames, frames[0].width, frames[0].height, fps);
}

interface FrameData {
  imageData: ImageData;
  width: number;
  height: number;
}

function extractFrames(file: File, startTime: number, endTime: number, fps: number): Promise<FrameData[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    const frames: FrameData[] = [];
    const interval = 1 / fps;
    let currentTime = startTime;

    video.onloadeddata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = startTime;
    };

    video.onseeked = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

      ctx.drawImage(video, 0, 0);
      frames.push({
        imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
        width: canvas.width,
        height: canvas.height,
      });

      currentTime += interval;
      if (currentTime <= endTime) {
        video.currentTime = currentTime;
      } else {
        URL.revokeObjectURL(video.src);
        resolve(frames);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video for frame extraction'));
    };

    video.src = URL.createObjectURL(file);
  });
}

function encodeFrames(frames: FrameData[], width: number, height: number, fps: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

    const stream = canvas.captureStream(0); // 0 = manual frame requests
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    recorder.onerror = () => reject(new Error('MediaRecorder error'));

    recorder.start();

    let frameIndex = 0;
    const frameInterval = 1000 / fps;

    function drawNextFrame() {
      if (frameIndex >= frames.length) {
        recorder.stop();
        return;
      }

      ctx!.putImageData(frames[frameIndex].imageData, 0, 0);
      // Request a frame from the captured stream
      const track = stream.getVideoTracks()[0];
      if (track && 'requestFrame' in track) {
        (track as unknown as { requestFrame: () => void }).requestFrame();
      }

      frameIndex++;
      setTimeout(drawNextFrame, frameInterval);
    }

    drawNextFrame();
  });
}
