"use client";

/**
 * OpenCut Editor Integration Component
 * 
 * This component integrates OpenCut's full video editing capabilities.
 * OpenCut source files have been copied to lib/opencut/ and paths adapted.
 */

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { PreviewPanel } from "@/lib/opencut/components/editor/preview-panel";
import { Timeline } from "@/lib/opencut/components/editor/timeline";
import { MediaPanel } from "@/lib/opencut/components/editor/media-panel";
import { PropertiesPanel } from "@/lib/opencut/components/editor/properties-panel";
import { EditorHeader } from "@/lib/opencut/components/editor/editor-header";
import { EditorProvider } from "@/lib/opencut/components/providers/editor-provider";
import { usePlaybackControls } from "@/lib/opencut/hooks/use-playback-controls";
import { usePanelStore } from "@/lib/opencut/stores/panel-store";
import { useProjectStore } from "@/lib/opencut/stores/project-store";
import { useTimelineStore } from "@/lib/opencut/stores/timeline-store";
import { useMediaStore } from "@/lib/opencut/stores/media-store";

// Video clip interface from video-editor
interface VideoClip {
  id: string;
  url: string;
  startTime: number;
  duration: number;
  sceneItemId?: string;
  shotNumber?: number;
  sceneNumber?: number;
  thumbnail?: string;
}

interface OpenCutEditorProps {
  videoClips?: VideoClip[];
  onVideoClipsChange?: (clips: VideoClip[]) => void;
}

export default function OpenCutEditor({ videoClips = [], onVideoClipsChange }: OpenCutEditorProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // OpenCut stores
  const {
    toolsPanel,
    previewPanel,
    mainContent,
    timeline,
    setToolsPanel,
    setPreviewPanel,
    setMainContent,
    setTimeline,
    propertiesPanel,
    setPropertiesPanel,
  } = usePanelStore();
  
  const { activeProject, createNewProject } = useProjectStore();
  const { addMediaFile } = useMediaStore();
  const { _loadTracks } = useTimelineStore();

  // Initialize OpenCut project if needed
  useEffect(() => {
    const initializeProject = async () => {
      if (!activeProject) {
        try {
          await createNewProject("Video Editor Project");
          setIsInitialized(true);
        } catch (error) {
          console.error("Failed to initialize OpenCut project:", error);
          setIsInitialized(true); // Still set initialized to show UI
        }
      } else {
        setIsInitialized(true);
      }
    };

    initializeProject();
  }, [activeProject, createNewProject]);

  // Sync video clips to OpenCut timeline
  useEffect(() => {
    if (!isInitialized || videoClips.length === 0) return;

    console.log('🔄 Syncing video clips to OpenCut timeline:', {
      videoClipsLength: videoClips.length,
    });

    // Create async function inside useEffect
    const syncVideoClips = async () => {
      try {
        // Add video files to media store
        const { activeProject } = useProjectStore.getState();
        if (!activeProject) {
          console.error('❌ No active project, cannot add media files');
          return;
        }

        // Add media files and collect their IDs
        const mediaIdMap = new Map<string, string>(); // clip.id -> mediaFile.id

        for (const clip of videoClips) {
          // Create a virtual File object for compatibility with MediaFile type
          const virtualFile = new File(
            [],
            `Clip ${clip.sceneNumber || ''}-${clip.shotNumber || ''}.mp4`,
            { type: 'video/mp4' }
          );

          const clipName = `Clip ${clip.sceneNumber || ''}-${clip.shotNumber || ''}`;
          
          await addMediaFile(activeProject.id, {
            name: clipName,
            type: 'video' as const,
            file: virtualFile,
            url: clip.url,
            thumbnailUrl: clip.thumbnail,
            duration: clip.duration,
            width: 1920,
            height: 1080,
          });

          // Find the added media file by URL to get its generated ID
          const { mediaFiles } = useMediaStore.getState();
          const addedMediaFile = mediaFiles.find(
            (item) => item.url === clip.url && item.name === clipName
          );
          
          if (addedMediaFile) {
            mediaIdMap.set(clip.id, addedMediaFile.id);
          }
        }

        // Create timeline track with elements using the correct media IDs
        const timelineTrack = {
          id: "track-media-1",
          name: "Video Track",
          type: "media" as const,
          elements: videoClips.map((clip) => ({
            id: clip.id,
            name: `Clip ${clip.sceneNumber || ''}-${clip.shotNumber || ''}`,
            duration: clip.duration,
            startTime: clip.startTime,
            trimStart: 0,
            trimEnd: 0,
            type: "media" as const,
            mediaId: mediaIdMap.get(clip.id) || clip.id, // Use mapped media file ID
          })),
          muted: false,
          isMain: true,
        };

        // Load tracks
        _loadTracks([timelineTrack]);

        console.log('📊 OpenCut timeline tracks loaded:', {
          trackCount: 1,
          elementCount: timelineTrack.elements.length,
        });
      } catch (error) {
        console.error('❌ Error syncing video clips to OpenCut:', error);
      }
    };

    syncVideoClips();
  }, [videoClips, isInitialized, addMediaFile, _loadTracks]);

  // Set up playback controls
  usePlaybackControls();

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-900">
        <div className="text-white">Initializing OpenCut Editor...</div>
      </div>
    );
  }

  return (
    <EditorProvider>
      <div ref={containerRef} className="h-full w-full flex flex-col bg-background overflow-hidden">
        <EditorHeader />
        <div className="flex-1 min-h-0 min-w-0">
          <ResizablePanelGroup
            direction="vertical"
            className="h-full w-full gap-[0.18rem]"
          >
            <ResizablePanel
              defaultSize={mainContent}
              minSize={30}
              maxSize={85}
              onResize={setMainContent}
              className="min-h-0"
            >
              {/* Main content area */}
              <ResizablePanelGroup
                direction="horizontal"
                className="h-full w-full gap-[0.19rem] px-3"
              >
                {/* Tools Panel */}
                <ResizablePanel
                  defaultSize={toolsPanel}
                  minSize={15}
                  maxSize={40}
                  onResize={setToolsPanel}
                  className="min-w-0 rounded-sm"
                >
                  <MediaPanel />
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* Preview Area */}
                <ResizablePanel
                  defaultSize={previewPanel}
                  minSize={30}
                  onResize={setPreviewPanel}
                  className="min-w-0 min-h-0 flex-1"
                >
                  <PreviewPanel />
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel
                  defaultSize={propertiesPanel}
                  minSize={15}
                  maxSize={40}
                  onResize={setPropertiesPanel}
                  className="min-w-0 rounded-sm"
                >
                  <PropertiesPanel />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Timeline */}
            <ResizablePanel
              defaultSize={timeline}
              minSize={15}
              maxSize={70}
              onResize={setTimeline}
              className="min-h-0 px-3 pb-3"
            >
              <Timeline />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </EditorProvider>
  );
}
