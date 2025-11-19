'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, Play, Pause, Download, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sceneId: string;
  videoClips: Array<{ url: string; startTime: number; duration: number }>;
  subtitles: Array<{ text: string; startTime: number; endTime: number; x?: number; y?: number }>;
  coverImage?: string;
  onExportComplete?: (videoUrl: string) => void;
}

type ExportStatus = 'idle' | 'preparing' | 'merging' | 'adding-subtitles' | 'finalizing' | 'completed' | 'error';

export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  sceneId,
  videoClips,
  subtitles,
  coverImage,
  onExportComplete,
}: ExportDialogProps) {
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setExportStatus('idle');
      setProgress(0);
      setError(null);
      setExportedVideoUrl(null);
      setIsPreviewPlaying(false);
    } else {
      // Cleanup EventSource when dialog closes
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [open]);

  const handleStartExport = async () => {
    if (videoClips.length === 0) {
      setError('No videos to export');
      return;
    }

    try {
      setExportStatus('preparing');
      setProgress(0);
      setError(null);

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
          includeSubtitles: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start export');
      }

      const { taskId } = await response.json();

      // Use Server-Sent Events to track progress
      const eventSource = new EventSource(`/api/projects/export-video/progress?taskId=${taskId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.status) {
          setExportStatus(data.status);
        }
        
        if (data.progress !== undefined) {
          setProgress(data.progress);
        }
        
        if (data.error) {
          setError(data.error);
          setExportStatus('error');
          eventSource.close();
        }
        
        if (data.completed && data.videoUrl) {
          setExportedVideoUrl(data.videoUrl);
          setExportStatus('completed');
          setProgress(100);
          eventSource.close();
          if (onExportComplete) {
            onExportComplete(data.videoUrl);
          }
        }
      };

      eventSource.onerror = () => {
        setError('Connection lost. Please check export status.');
        eventSource.close();
      };
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start export');
      setExportStatus('error');
    }
  };

  const handleDownload = () => {
    if (exportedVideoUrl) {
      const a = document.createElement('a');
      a.href = exportedVideoUrl;
      a.download = `exported_video_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
        return 'Preparing videos...';
      case 'merging':
        return 'Merging videos...';
      case 'adding-subtitles':
        return 'Adding subtitles...';
      case 'finalizing':
        return 'Finalizing video...';
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
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-1">Video Clips</div>
              <div className="text-lg font-semibold text-white">{videoClips.length}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-1">Subtitles</div>
              <div className="text-lg font-semibold text-white">{subtitles.length}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-1">Duration</div>
              <div className="text-lg font-semibold text-white">
                {formatDuration(videoClips.reduce((sum, clip) => sum + clip.duration, 0))}
              </div>
            </div>
          </div>

          {/* Progress Section - CapCut style progress bar */}
          {exportStatus !== 'idle' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium text-base">{getStatusText()}</span>
                <span className="text-yellow-400 font-bold text-lg">{Math.round(progress)}%</span>
              </div>
              <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                <motion.div
                  className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" 
                     style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
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
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

