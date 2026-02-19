'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Play, Pause, Download, Image as ImageIcon } from 'lucide-react';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sceneId: string;
  videoClips: Array<{ url: string; startTime: number; duration: number }>;
  subtitles: Array<{ text: string; startTime: number; endTime: number; x?: number; y?: number }>;
  coverImage?: string;
  onExportComplete?: (videoUrl: string) => void;
  includeSubtitles?: boolean; // Whether to include subtitles in exported video
}

type ExportStatus = 'idle' | 'preparing' | 'merging' | 'adding-subtitles' | 'finalizing' | 'completed' | 'error';

type TaskProgressPayload = {
  status?: ExportStatus | string;
  progress?: number;
  videoUrl?: string | null;
  error?: string | null;
  completed?: boolean;
};

const POLLING_INTERVAL_MS = 3000;
const POLLING_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  sceneId,
  videoClips,
  subtitles,
  coverImage,
  onExportComplete,
  includeSubtitles = true, // Default to including subtitles
}: ExportDialogProps) {
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStartTimeRef = useRef<number | null>(null);

  const stopProgressPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingStartTimeRef.current = null;
  }, []);

  const cleanupTracking = useCallback(() => {
    stopProgressPolling();
  }, [stopProgressPolling]);

  const downloadVideo = useCallback(
    async (videoUrl: string) => {
      try {
        // 尝试通过 fetch 下载（适用于同源或支持 CORS 的情况）
        const response = await fetch(videoUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch exported video (${response.status})`);
        }
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `exported_video_${Date.now()}.mp4`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(objectUrl);
      } catch (downloadError) {
        // 如果 fetch 失败（可能是 CORS 问题），尝试直接使用 download 属性
        // 注意：跨域时 download 属性可能不生效，但至少不会打开新窗口
        try {
          const a = document.createElement('a');
          a.href = videoUrl;
          a.download = `exported_video_${Date.now()}.mp4`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (directDownloadError) {
          setError('下载失败，请检查网络连接或联系管理员');
        }
      }
    },
    [setError]
  );

  const applyTaskUpdate = useCallback(
    (data: TaskProgressPayload) => {
      if (data.status) {
        setExportStatus(data.status as ExportStatus);
      }

      if (data.progress !== undefined) {
        setProgress(data.progress);
      }

      if (data.error) {
        setError(data.error);
        setExportStatus('error');
        cleanupTracking();
        return;
      }

      setError(null);

      // 如果提供了 videoUrl，立即更新
      if (data.videoUrl) {
        setExportedVideoUrl(data.videoUrl);
      }

      if (data.completed) {
        if (data.status === 'error') {
          setExportStatus('error');
          cleanupTracking();
          return;
        }

        // 任务已完成，停止轮询
        cleanupTracking();
        setCurrentTaskId(null);

        // 设置完成状态
        setExportStatus('completed');
        
        if (data.videoUrl) {
          setExportedVideoUrl(data.videoUrl);
          if (onExportComplete) {
            onExportComplete(data.videoUrl);
          }
          // 不再自动下载，用户需要点击下载按钮
        } else {
          // 即使没有 videoUrl，也标记为完成（可能是其他原因）
        }
      }
    },
    [cleanupTracking, onExportComplete]
  );

  const startProgressPolling = useCallback(
    (taskId: string) => {
      stopProgressPolling();
      pollingStartTimeRef.current = Date.now();
      pollingIntervalRef.current = setInterval(async () => {
        if (pollingStartTimeRef.current && Date.now() - pollingStartTimeRef.current > POLLING_TIMEOUT_MS) {
          stopProgressPolling();
          setError("We couldn't finish the export. Please try again.");
          setExportStatus('error');
          setCurrentTaskId(null);
          return;
        }

        try {
          const response = await fetch(`/api/projects/export-video/progress?taskId=${taskId}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 404) {
              // 不要立即停止轮询，可能是暂时的数据库延迟
              // 继续轮询几次，如果还是404再报错
              // 只在连续多次404后才报错
              return;
            } else if (response.status === 403) {
              applyTaskUpdate({
                status: 'error',
                error: 'Not authorized to access this task',
                completed: true,
              });
              stopProgressPolling();
              return;
            }
            return;
          }
          const data = await response.json();
          applyTaskUpdate(data);
          if (data.completed) {
            stopProgressPolling();
          }
        } catch (pollError) {
        }
      }, POLLING_INTERVAL_MS);
    },
    [applyTaskUpdate, stopProgressPolling]
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setExportStatus('idle');
      setError(null);
      setExportedVideoUrl(null);
      setIsPreviewPlaying(false);
      setProgress(0);
    } else {
      cleanupTracking();
    }
  }, [cleanupTracking, open]);

  useEffect(() => {
    return () => {
      cleanupTracking();
    };
  }, [cleanupTracking]);

  const handleStartExport = async () => {
    if (videoClips.length === 0) {
      setError('No videos to export');
      return;
    }

    try {
      setExportStatus('preparing');
      setError(null);

      cleanupTracking();
      setExportedVideoUrl(null);
      setCurrentTaskId(null);

      // Start export via API
      const response = await fetch('/api/projects/export-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          sceneId,
          videoClips: videoClips.map(clip => ({
            url: clip.url,
            startTime: clip.startTime,
            duration: clip.duration,
          })),
          subtitles: subtitles.map(sub => ({
            text: sub.text,
            startTime: sub.startTime,
            endTime: sub.endTime,
            x: sub.x || 100,
            y: sub.y || undefined,
          })),
          includeSubtitles: includeSubtitles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start export');
      }

      const { taskId } = await response.json();
      setCurrentTaskId(taskId);
      startProgressPolling(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start export');
      setExportStatus('error');
    }
  };

  const handleCheckStatus = async () => {
    if (!currentTaskId) {
      setError('No task ID available');
      return;
    }

    try {
      const response = await fetch(`/api/projects/export-video/progress?taskId=${currentTaskId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Task not found. It may have expired.');
          setExportStatus('error');
          return;
        }
        throw new Error(`Failed to check status: ${response.statusText}`);
      }

      const data = await response.json();
      applyTaskUpdate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check export status');
    }
  };

  const handleDownload = () => {
    if (exportedVideoUrl) {
      void downloadVideo(exportedVideoUrl);
    }
  };

  const handlePreviewToggle = () => {
    if (videoRef.current) {
      if (isPreviewPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  };

  const getStatusText = () => {
    switch (exportStatus) {
      case 'preparing':
        return 'Warming up your clips...';
      case 'merging':
        return 'Stitching every shot together...';
      case 'adding-subtitles':
        return 'Dropping subtitles into place...';
      case 'finalizing':
        return 'Polishing the final video...';
      case 'completed':
        return 'Export completed!';
      case 'error':
        return 'Export failed';
      default:
        return 'Ready to export';
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white text-2xl font-bold">Export Video</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 py-6 space-y-6">
          {/* Cover Preview - Large preview area like CapCut */}
          <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl">
            {exportedVideoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={exportedVideoUrl}
                  className="w-full h-full object-cover"
                  onPlay={() => setIsPreviewPlaying(true)}
                  onPause={() => setIsPreviewPlaying(false)}
                />
                {/* Preview Play Button - Only show for exported video */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer group">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePreviewToggle}
                    className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md transition-all group-hover:scale-110"
                  >
                    {isPreviewPlaying ? (
                      <Pause className="w-10 h-10 text-white" />
                    ) : (
                      <Play className="w-10 h-10 text-white ml-1" />
                    )}
                  </Button>
                </div>
              </>
            ) : coverImage ? (
              <img
                src={coverImage}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : videoClips.length > 0 ? (
              <div className="relative w-full h-full">
                <img
                  src={videoClips[0].url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // If image load fails, hide the image
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                {exportStatus === 'idle' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 text-white/60 mx-auto mb-2" />
                      <p className="text-white/80 text-sm">Preview</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center">
                  <ImageIcon className="w-20 h-20 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No preview available</p>
                </div>
              </div>
            )}
          </div>

          {/* Export Info - CapCut style info cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-0.5">Video Clips</div>
              <div className="text-base font-semibold text-white">{videoClips.length}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-0.5">Subtitles</div>
              <div className="text-base font-semibold text-white">{subtitles.length}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-0.5">Duration</div>
              <div className="text-base font-semibold text-white">
                {formatDuration(videoClips.reduce((sum, clip) => sum + clip.duration, 0))}
              </div>
            </div>
          </div>

          {/* Status Section - Loading animation instead of progress */}
          <div className="space-y-3 p-4 bg-gray-800/40 rounded-xl border border-gray-700/60">
            {exportStatus === 'idle' && (
              <div>
                <p className="text-white font-semibold text-base">Ready to export</p>
                <p className="text-xs text-gray-400">
                  Hit "Start Export" and we'll stitch every clip on our servers.
                </p>
              </div>
            )}

            {(exportStatus === 'preparing' ||
              exportStatus === 'merging' ||
              exportStatus === 'adding-subtitles' ||
              exportStatus === 'finalizing') && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white font-semibold text-base">{getStatusText()}</p>
                    <p className="text-xs text-gray-400">{progress}%</p>
                  </div>
                  <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Hang tight while we assemble your video and push it to storage.
                  </p>
                </div>
              </>
            )}

            {exportStatus === 'completed' && (
              <div>
                <p className="text-green-400 font-semibold text-base flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Your video is ready!
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Preview it above or click the download button below to save your video.
                </p>
              </div>
            )}

            {exportStatus === 'error' && (
              <div>
                <p className="text-red-400 font-semibold text-base">We couldn't finish the export.</p>
                <p className="text-xs text-gray-400">
                  Please review the error below and try again.
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              {exportStatus === 'idle' && (
                <Button
                  onClick={handleStartExport}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
                >
                  Start Export
                </Button>
              )}
              
              {exportStatus === 'completed' && exportedVideoUrl && (
                <>
                  <Button
                    onClick={handleDownload}
                    className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-base py-6 shadow-lg hover:shadow-yellow-400/50 transition-all"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download Video
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    Close
                  </Button>
                </>
              )}
              
              {exportStatus === 'completed' && !exportedVideoUrl && (
                <div className="flex-1 p-4 bg-yellow-400/10 border border-yellow-400/30 rounded-lg">
                  <p className="text-yellow-400 text-sm text-center">
                    Video processing completed. Waiting for video URL...
                  </p>
                </div>
              )}

              {(exportStatus === 'preparing' || exportStatus === 'merging' || 
                exportStatus === 'adding-subtitles' || exportStatus === 'finalizing') && (
                <Button
                  disabled
                  className="flex-1 bg-gray-700 text-gray-400 cursor-not-allowed"
                >
                  Exporting...
                </Button>
              )}

              {exportStatus === 'error' && (
                <Button
                  onClick={handleStartExport}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
                >
                  Retry
                </Button>
              )}
            </div>
            
            {/* Check Status Button - Show when connection is lost or error occurs */}
            {(error && error.includes('Connection lost') && currentTaskId) || 
             (exportStatus === 'error' && currentTaskId) ? (
              <Button
                onClick={handleCheckStatus}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold"
              >
                Check Status
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

