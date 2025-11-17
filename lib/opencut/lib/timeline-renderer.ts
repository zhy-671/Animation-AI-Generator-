import type { TimelineTrack } from "@/lib/opencut/types/timeline";
import type { MediaFile } from "@/lib/opencut/types/media";
import type { BlurIntensity } from "@/lib/opencut/types/project";
import { videoCache } from "./video-cache";
import { drawCssBackground } from "./canvas-gradients";

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  time: number;
  canvasWidth: number;
  canvasHeight: number;
  tracks: TimelineTrack[];
  mediaFiles: MediaFile[];
  backgroundColor?: string;
  backgroundType?: "color" | "blur";
  blurIntensity?: BlurIntensity;
  projectCanvasSize?: { width: number; height: number };
}

const imageElementCache = new Map<string, HTMLImageElement>();
const videoElementCache = new Map<string, HTMLVideoElement>();

async function getImageElement(
  mediaItem: MediaFile
): Promise<HTMLImageElement> {
  const cacheKey = mediaItem.id;
  const cached = imageElementCache.get(cacheKey);
  if (cached) return cached;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = mediaItem.url || URL.createObjectURL(mediaItem.file);
  });
  imageElementCache.set(cacheKey, img);
  return img;
}

async function getVideoElement(
  mediaItem: MediaFile
): Promise<HTMLVideoElement> {
  const cacheKey = mediaItem.id;
  const cached = videoElementCache.get(cacheKey);
  if (cached) {
    // Check if cached video is still valid
    if (cached.readyState >= 1) {
      return cached;
    }
    // Remove invalid cached video
    videoElementCache.delete(cacheKey);
  }
  
  let video = document.createElement("video");
  
  // For virtual files (remote URLs), use url directly
  // For local files, use URL.createObjectURL
  if (mediaItem.url) {
    video.src = mediaItem.url;
    // Try without crossOrigin first for remote URLs to avoid format errors
    // We'll set crossOrigin later if needed for canvas operations
    video.crossOrigin = null;
  } else if (mediaItem.file && mediaItem.file.size > 0) {
    video.src = URL.createObjectURL(mediaItem.file);
  } else {
    throw new Error("No valid video source available");
  }
  
  video.muted = true;
  video.preload = "metadata"; // Changed back to "metadata" to avoid format errors
  video.playsInline = true;
  
  // Note: We don't set type attribute directly on video element
  // The browser will detect the format from the URL/file extension
  
  // Add video to DOM temporarily (hidden) to ensure it loads properly
  // Some browsers require video elements to be in the DOM for proper loading
  video.style.position = "absolute";
  video.style.top = "-9999px";
  video.style.left = "-9999px";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  document.body.appendChild(video);
  
  try {
    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("canplaythrough", onCanPlayThrough);
          video.removeEventListener("error", onError);
          console.warn(`⏰ Video load timeout after 30s: ${mediaItem.url?.substring(0, 50)}..., readyState: ${video.readyState}, networkState: ${video.networkState}`);
          // If video has some data loaded, resolve anyway
          if (video.readyState >= 1) {
            console.log(`✅ Video has some data loaded (readyState: ${video.readyState}), resolving anyway`);
            resolve();
          } else {
            reject(new Error(`Video load timeout after 30s: ${mediaItem.url?.substring(0, 50)}...`));
          }
        }
      }, 30000); // 30 second timeout (increased from 10s)
      
      const onLoadedMetadata = () => {
        if (!resolved) {
          console.log(`📹 Video metadata loaded: ${mediaItem.name}`, {
            readyState: video.readyState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            duration: video.duration,
          });
          // Don't resolve yet, wait for canplay
        }
      };
      
      const onCanPlay = () => {
        if (!resolved && video.readyState >= 2) {
          resolved = true;
          clearTimeout(timeout);
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("canplaythrough", onCanPlayThrough);
          video.removeEventListener("error", onError);
          console.log(`✅ Video can play: ${mediaItem.name}`);
          resolve();
        }
      };
      
      const onCanPlayThrough = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("canplaythrough", onCanPlayThrough);
          video.removeEventListener("error", onError);
          console.log(`✅ Video can play through: ${mediaItem.name}`);
          resolve();
        }
      };
      
      const onError = (e: Event) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("canplaythrough", onCanPlayThrough);
          video.removeEventListener("error", onError);
          
          const error = video.error;
          const errorMsg = error 
            ? `Video error code ${error.code}: ${error.message || 'Unknown error'}`
            : 'Video load failed';
          console.error(`❌ Video load error: ${errorMsg}`, {
            errorCode: error?.code,
            errorMessage: error?.message,
            videoSrc: video.src?.substring(0, 50),
            readyState: video.readyState,
            networkState: video.networkState,
          });
          
          // Format error (code 4) - try different approaches
          if (error?.code === 4 && mediaItem.url) {
            console.warn(`⚠️ Format error (code 4) detected. Video URL: ${mediaItem.url?.substring(0, 100)}`);
            console.warn(`⚠️ Video state: readyState=${video.readyState}, networkState=${video.networkState}, src=${video.src?.substring(0, 50)}`);
            
            // If we haven't tried without CORS yet, reject to trigger retry
            if (video.crossOrigin === "anonymous") {
              console.warn(`⚠️ Format error with CORS, will retry without crossOrigin`);
              reject(new Error('FORMAT_ERROR_WITH_CORS'));
            } else {
              // Already tried without CORS, try with different preload strategy
              console.warn(`⚠️ Format error persists without CORS, video may be unsupported format`);
              reject(new Error(`FORMAT_ERROR: ${errorMsg} - URL: ${mediaItem.url?.substring(0, 50)}...`));
            }
          } else {
            reject(new Error(`${errorMsg} - URL: ${mediaItem.url?.substring(0, 50)}...`));
          }
        }
      };
      
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("canplaythrough", onCanPlayThrough);
      video.addEventListener("error", onError);
      
      // If video is already loaded, resolve immediately
      if (video.readyState >= 2) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("canplay", onCanPlay);
          video.removeEventListener("canplaythrough", onCanPlayThrough);
          video.removeEventListener("error", onError);
          console.log(`✅ Video already ready: ${mediaItem.name}`);
          resolve();
        }
      }
    });
  } catch (error) {
    // If loading with crossOrigin fails, try without it (fallback for servers that don't support CORS)
    const errorMessage = (error as Error)?.message || String(error);
    if (mediaItem.url && (video.crossOrigin === "anonymous" || errorMessage.includes('FORMAT_ERROR_WITH_CORS'))) {
      console.warn(`Video failed to load with crossOrigin, retrying without it: ${mediaItem.url?.substring(0, 50)}...`);
      
      // Remove video from DOM before retrying
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      
      // Create a new video element without crossOrigin
      const newVideo = document.createElement("video");
      newVideo.src = mediaItem.url;
      newVideo.crossOrigin = null; // No CORS
      newVideo.muted = true;
      newVideo.preload = "metadata"; // Use metadata instead of auto to avoid format errors
      newVideo.playsInline = true;
      
      // Note: Browser will detect format from URL extension
      
      // Add to DOM
      newVideo.style.position = "absolute";
      newVideo.style.top = "-9999px";
      newVideo.style.left = "-9999px";
      newVideo.style.width = "1px";
      newVideo.style.height = "1px";
      newVideo.style.opacity = "0";
      newVideo.style.pointerEvents = "none";
      document.body.appendChild(newVideo);
      
      // Replace the old video reference (video is declared with let, so this is allowed)
      video = newVideo;
      
      // Update cache with new video element
      videoElementCache.set(cacheKey, newVideo);
      
      await new Promise<void>((resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("canplaythrough", onCanPlayThrough);
            video.removeEventListener("error", onError);
            console.warn(`⏰ Video load timeout after 30s (retry without CORS): ${mediaItem.url?.substring(0, 50)}..., readyState: ${video.readyState}, networkState: ${video.networkState}`);
            // If video has some data loaded, resolve anyway
            if (video.readyState >= 1) {
              console.log(`✅ Video has some data loaded (readyState: ${video.readyState}), resolving anyway`);
              resolve();
            } else {
              reject(new Error(`Video load timeout after 30s (retry without CORS): ${mediaItem.url?.substring(0, 50)}...`));
            }
          }
        }, 30000); // 30 second timeout (increased from 10s)
        
        const onLoadedMetadata = () => {
          if (!resolved) {
            console.log(`📹 Video metadata loaded (retry without CORS): ${mediaItem.name}`);
            // Don't resolve yet, wait for canplay
          }
        };
        
        const onCanPlay = () => {
          if (!resolved && video.readyState >= 2) {
            resolved = true;
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("canplaythrough", onCanPlayThrough);
            video.removeEventListener("error", onError);
            console.log(`✅ Video can play (retry without CORS): ${mediaItem.name}`);
            resolve();
          } else if (!resolved && video.readyState >= 1) {
            // If metadata is loaded, resolve anyway
            resolved = true;
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("canplaythrough", onCanPlayThrough);
            video.removeEventListener("error", onError);
            console.log(`✅ Video metadata loaded (retry without CORS, readyState: ${video.readyState}): ${mediaItem.name}`);
            resolve();
          }
        };
        
        const onCanPlayThrough = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("canplaythrough", onCanPlayThrough);
            video.removeEventListener("error", onError);
            console.log(`✅ Video can play through (retry without CORS): ${mediaItem.name}`);
            resolve();
          }
        };
        
        const onError = (e: Event) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("canplaythrough", onCanPlayThrough);
            video.removeEventListener("error", onError);
            
            const videoError = video.error;
            console.error(`❌ Video error (retry without CORS):`, {
              errorCode: videoError?.code,
              errorMessage: videoError?.message,
              readyState: video.readyState,
              networkState: video.networkState,
              src: video.src?.substring(0, 50),
            });
            
            // If it's still a format error, log more details but don't retry again
            if (videoError?.code === 4) {
              console.error(`❌ Format error persists even without CORS. Video may be unsupported format or corrupted.`);
              console.error(`❌ Video URL: ${mediaItem.url}`);
              console.error(`❌ Try checking if the video URL is accessible and in a supported format (MP4, WebM, etc.)`);
            }
            
            reject(error); // Re-throw original error
          }
        };
        
        video.addEventListener("loadedmetadata", onLoadedMetadata);
        video.addEventListener("canplay", onCanPlay);
        video.addEventListener("canplaythrough", onCanPlayThrough);
        video.addEventListener("error", onError);
        
        if (video.readyState >= 2) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("canplaythrough", onCanPlayThrough);
            video.removeEventListener("error", onError);
            console.log(`✅ Video already ready (retry without CORS): ${mediaItem.name}`);
            resolve();
          }
        } else if (video.readyState >= 1) {
          // If metadata is already loaded, resolve anyway
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("canplay", onCanPlay);
            video.removeEventListener("canplaythrough", onCanPlayThrough);
            video.removeEventListener("error", onError);
            console.log(`✅ Video metadata already loaded (retry without CORS, readyState: ${video.readyState}): ${mediaItem.name}`);
            resolve();
          }
        }
      });
    } else {
      // Clean up video element if it was added to DOM
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      throw error; // Re-throw if not a CORS issue or already retried
    }
  }
  
  // Cache the video element (if not already cached)
  if (!videoElementCache.has(cacheKey)) {
    videoElementCache.set(cacheKey, video);
  }
  return video;
}

export async function renderTimelineFrame({
  ctx,
  time,
  canvasWidth,
  canvasHeight,
  tracks,
  mediaFiles,
  backgroundColor,
  backgroundType,
  blurIntensity,
  projectCanvasSize,
}: RenderContext): Promise<void> {
  // Background
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  if (
    backgroundColor &&
    backgroundColor !== "transparent" &&
    !backgroundColor.includes("gradient")
  ) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // If backgroundColor is a CSS gradient string, draw it
  if (backgroundColor && backgroundColor.includes("gradient")) {
    drawCssBackground(ctx, canvasWidth, canvasHeight, backgroundColor);
  }

  const scaleX = projectCanvasSize ? canvasWidth / projectCanvasSize.width : 1;
  const scaleY = projectCanvasSize
    ? canvasHeight / projectCanvasSize.height
    : 1;
  const idToMedia = new Map(mediaFiles.map((m) => [m.id, m] as const));
  const active: Array<{
    track: TimelineTrack;
    element: TimelineTrack["elements"][number];
    mediaItem: MediaFile | null;
  }> = [];

  for (let t = tracks.length - 1; t >= 0; t -= 1) {
    const track = tracks[t];
    for (const element of track.elements) {
      if (element.hidden) continue;
      const elementStart = element.startTime;
      const elementEnd =
        element.startTime +
        (element.duration - element.trimStart - element.trimEnd);
      if (time >= elementStart && time < elementEnd) {
        let mediaItem: MediaFile | null = null;
        if (element.type === "media") {
          mediaItem =
            element.mediaId === "test"
              ? null
              : idToMedia.get(element.mediaId) || null;
        }
        active.push({ track, element, mediaItem });
      }
    }
  }

  // If background is set to blur, draw the active media as a blurred cover layer first
  if (backgroundType === "blur") {
    const blurPx = Math.max(0, blurIntensity ?? 8);
    // Find a suitable media element (video/image) among active elements
    const bgCandidate = active.find(({ element, mediaItem }) => {
      return (
        element.type === "media" &&
        mediaItem !== null &&
        (mediaItem.type === "video" || mediaItem.type === "image")
      );
    });
    if (bgCandidate && bgCandidate.mediaItem) {
      const { element, mediaItem } = bgCandidate;
      try {
        if (mediaItem.type === "video") {
          const localTime = time - element.startTime + element.trimStart;
          const frame = await videoCache.getFrameAt(
            mediaItem.id,
            mediaItem.file,
            Math.max(0, localTime)
          );
          if (frame) {
            const mediaW = Math.max(1, mediaItem.width || canvasWidth);
            const mediaH = Math.max(1, mediaItem.height || canvasHeight);
            const coverScale = Math.max(
              canvasWidth / mediaW,
              canvasHeight / mediaH
            );
            const drawW = mediaW * coverScale;
            const drawH = mediaH * coverScale;
            const drawX = (canvasWidth - drawW) / 2;
            const drawY = (canvasHeight - drawH) / 2;
            ctx.save();
            ctx.filter = `blur(${blurPx}px)`;
            ctx.drawImage(frame.canvas, drawX, drawY, drawW, drawH);
            ctx.restore();
          }
        } else if (mediaItem.type === "image") {
          const img = await getImageElement(mediaItem);
          const mediaW = Math.max(
            1,
            mediaItem.width || img.naturalWidth || canvasWidth
          );
          const mediaH = Math.max(
            1,
            mediaItem.height || img.naturalHeight || canvasHeight
          );
          const coverScale = Math.max(
            canvasWidth / mediaW,
            canvasHeight / mediaH
          );
          const drawW = mediaW * coverScale;
          const drawH = mediaH * coverScale;
          const drawX = (canvasWidth - drawW) / 2;
          const drawY = (canvasHeight - drawH) / 2;
          ctx.save();
          ctx.filter = `blur(${blurPx}px)`;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
        }
      } catch {
        // Ignore background blur failures; foreground will still render
      }
    }
  }

  for (const { element, mediaItem } of active) {
    if (element.type === "media" && mediaItem) {
      if (mediaItem.type === "video") {
        try {
          const localTime = time - element.startTime + element.trimStart;

          const frame = await videoCache.getFrameAt(
            mediaItem.id,
            mediaItem.file,
            localTime
          );
          
          // If videoCache returns null (virtual file from remote URL), use HTML5 video element
          if (!frame) {
            // For remote URL videos, use HTML5 video element to render frame
            if (mediaItem.url && mediaItem.file.size === 0) {
              try {
                console.log(`🎬 Rendering remote video: ${mediaItem.name} at time ${localTime.toFixed(2)}s`);
                const video = await getVideoElement(mediaItem);
                
                console.log(`📹 Video element state:`, {
                  readyState: video.readyState,
                  videoWidth: video.videoWidth,
                  videoHeight: video.videoHeight,
                  duration: video.duration,
                  currentTime: video.currentTime,
                  src: video.src?.substring(0, 50),
                });
                
                // Ensure video is ready before seeking/drawing
                if (video.readyState < 2) {
                  console.log(`⏳ Waiting for video to be ready (current readyState: ${video.readyState})`);
                  // Wait for video to be ready
                  await new Promise<void>((resolve, reject) => {
                    const onCanPlay = () => {
                      video.removeEventListener("canplay", onCanPlay);
                      video.removeEventListener("error", onError);
                      console.log(`✅ Video ready (readyState: ${video.readyState})`);
                      resolve();
                    };
                    const onError = () => {
                      video.removeEventListener("canplay", onCanPlay);
                      video.removeEventListener("error", onError);
                      console.error(`❌ Video error:`, video.error);
                      reject(new Error("Video not ready"));
                    };
                    video.addEventListener("canplay", onCanPlay);
                    video.addEventListener("error", onError);
                    
                    // Timeout fallback
                    setTimeout(() => {
                      video.removeEventListener("canplay", onCanPlay);
                      video.removeEventListener("error", onError);
                      if (video.readyState >= 2) {
                        console.log(`✅ Video ready after timeout (readyState: ${video.readyState})`);
                        resolve();
                      } else if (video.readyState >= 1) {
                        // If video has metadata loaded, resolve anyway
                        console.warn(`⚠️ Video has metadata but not fully ready (readyState: ${video.readyState}), resolving anyway`);
                        resolve();
                      } else {
                        console.warn(`⚠️ Video ready timeout (readyState: ${video.readyState})`);
                        reject(new Error("Video ready timeout"));
                      }
                    }, 10000); // Increased timeout to 10s
                  });
                }
                
                // Seek to the correct time if needed
                const clampedLocalTime = Math.max(0, Math.min(localTime, video.duration || localTime));
                const timeDiff = Math.abs(video.currentTime - clampedLocalTime);
                console.log(`⏰ Seeking video: currentTime=${video.currentTime.toFixed(2)}s, targetTime=${clampedLocalTime.toFixed(2)}s, diff=${timeDiff.toFixed(2)}s`);
                
                if (timeDiff > 0.1 || video.currentTime === 0) {
                  video.currentTime = clampedLocalTime;
                  await new Promise<void>((resolve) => {
                    const onSeeked = () => {
                      video.removeEventListener("seeked", onSeeked);
                      console.log(`✅ Video seeked to ${video.currentTime.toFixed(2)}s`);
                      resolve();
                    };
                    video.addEventListener("seeked", onSeeked);
                    
                    // Timeout fallback
                    setTimeout(() => {
                      video.removeEventListener("seeked", onSeeked);
                      console.log(`⏰ Seek timeout, using current time ${video.currentTime.toFixed(2)}s`);
                      resolve();
                    }, 2000);
                  });
                }

                // Ensure video dimensions are available
                const mediaW = Math.max(1, mediaItem.width || video.videoWidth || canvasWidth);
                const mediaH = Math.max(1, mediaItem.height || video.videoHeight || canvasHeight);
                
                console.log(`📐 Video dimensions:`, {
                  mediaW,
                  mediaH,
                  canvasWidth,
                  canvasHeight,
                  videoWidth: video.videoWidth,
                  videoHeight: video.videoHeight,
                });
                
                if (mediaW > 0 && mediaH > 0) {
                  const containScale = Math.min(
                    canvasWidth / mediaW,
                    canvasHeight / mediaH
                  );
                  const drawW = mediaW * containScale;
                  const drawH = mediaH * containScale;
                  const drawX = (canvasWidth - drawW) / 2;
                  const drawY = (canvasHeight - drawH) / 2;

                  console.log(`🎨 Drawing video:`, {
                    drawX: drawX.toFixed(2),
                    drawY: drawY.toFixed(2),
                    drawW: drawW.toFixed(2),
                    drawH: drawH.toFixed(2),
                  });

                  // Draw video frame to canvas
                  ctx.drawImage(video, drawX, drawY, drawW, drawH);
                  console.log(`✅ Video drawn successfully`);
                } else {
                  console.warn(`⚠️ Video dimensions not available for ${mediaItem.name}, skipping draw`);
                }
              } catch (error) {
                const errorMessage = (error as Error)?.message || String(error);
                // If it's a timeout error and video has some data, try to render anyway
                if (errorMessage.includes('timeout') && video && video.readyState >= 1) {
                  console.warn(`⚠️ Video timeout but has data (readyState: ${video.readyState}), attempting to render anyway for ${mediaItem.name}`);
                  try {
                    const mediaW = Math.max(1, mediaItem.width || video.videoWidth || canvasWidth);
                    const mediaH = Math.max(1, mediaItem.height || video.videoHeight || canvasHeight);
                    
                    if (mediaW > 0 && mediaH > 0) {
                      const containScale = Math.min(
                        canvasWidth / mediaW,
                        canvasHeight / mediaH
                      );
                      const drawW = mediaW * containScale;
                      const drawH = mediaH * containScale;
                      const drawX = (canvasWidth - drawW) / 2;
                      const drawY = (canvasHeight - drawH) / 2;

                      ctx.drawImage(video, drawX, drawY, drawW, drawH);
                      console.log(`✅ Video rendered despite timeout`);
                    }
                  } catch (renderError) {
                    console.error(
                      `❌ Failed to render remote video frame for ${mediaItem.name} (fallback also failed):`,
                      renderError
                    );
                  }
                } else {
                  console.error(
                    `❌ Failed to render remote video frame for ${mediaItem.name}:`,
                    error
                  );
                }
              }
            }
            continue;
          }

          const mediaW = Math.max(1, mediaItem.width || canvasWidth);
          const mediaH = Math.max(1, mediaItem.height || canvasHeight);
          const containScale = Math.min(
            canvasWidth / mediaW,
            canvasHeight / mediaH
          );
          const drawW = mediaW * containScale;
          const drawH = mediaH * containScale;
          const drawX = (canvasWidth - drawW) / 2;
          const drawY = (canvasHeight - drawH) / 2;

          ctx.drawImage(frame.canvas, drawX, drawY, drawW, drawH);
        } catch (error) {
          console.warn(
            `Failed to render video frame for ${mediaItem.name}:`,
            error
          );
        }
      }
      if (mediaItem.type === "image") {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image load failed"));
          img.src = mediaItem.url || URL.createObjectURL(mediaItem.file);
        });
        const mediaW = Math.max(
          1,
          mediaItem.width || img.naturalWidth || canvasWidth
        );
        const mediaH = Math.max(
          1,
          mediaItem.height || img.naturalHeight || canvasHeight
        );
        const containScale = Math.min(
          canvasWidth / mediaW,
          canvasHeight / mediaH
        );
        const drawW = mediaW * containScale;
        const drawH = mediaH * containScale;
        const drawX = (canvasWidth - drawW) / 2;
        const drawY = (canvasHeight - drawH) / 2;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }
    }
    if (element.type === "text") {
      const text = element;
      const posX = canvasWidth / 2 + text.x * scaleX;
      const posY = canvasHeight / 2 + text.y * scaleY;
      ctx.save();
      ctx.translate(posX, posY);
      ctx.rotate((text.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, Math.min(1, text.opacity));
      const px = text.fontSize * scaleX;
      const weight = text.fontWeight === "bold" ? "bold " : "";
      const style = text.fontStyle === "italic" ? "italic " : "";
      ctx.font = `${style}${weight}${px}px ${text.fontFamily}`;
      ctx.fillStyle = text.color;
      ctx.textAlign = text.textAlign as CanvasTextAlign;
      ctx.textBaseline = "middle";
      const metrics = ctx.measureText(text.content);
      const hasBoxMetrics =
        "actualBoundingBoxAscent" in metrics &&
        "actualBoundingBoxDescent" in metrics;
      const ascent = hasBoxMetrics
        ? (
            metrics as TextMetrics & {
              actualBoundingBoxAscent: number;
              actualBoundingBoxDescent: number;
            }
          ).actualBoundingBoxAscent
        : px * 0.8;
      const descent = hasBoxMetrics
        ? (
            metrics as TextMetrics & {
              actualBoundingBoxAscent: number;
              actualBoundingBoxDescent: number;
            }
          ).actualBoundingBoxDescent
        : px * 0.2;
      const textW = metrics.width;
      const textH = ascent + descent;
      const padX = 8 * scaleX;
      const padY = 4 * scaleX;
      if (text.backgroundColor) {
        ctx.save();
        ctx.fillStyle = text.backgroundColor;
        let bgLeft = -textW / 2;
        if (ctx.textAlign === "left") bgLeft = 0;
        if (ctx.textAlign === "right") bgLeft = -textW;
        ctx.fillRect(
          bgLeft - padX,
          -textH / 2 - padY,
          textW + padX * 2,
          textH + padY * 2
        );
        ctx.restore();
      }
      ctx.fillText(text.content, 0, 0);
      ctx.restore();
    }
  }
}
