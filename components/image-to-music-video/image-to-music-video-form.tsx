"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Upload, X, Image as ImageIcon, Music, Video, Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { useToast } from "@/components/ui/toast-notification";
import { createClient } from "@/lib/supabase/client";

interface AudioSegment {
  id: string;
  start: number;
  end: number;
  audioUrl: string;
  isPlaying: boolean;
}

export default function ImageToMusicVideoForm() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  
  const [prompt, setPrompt] = useState<string>("");
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const { showSuccess, showError, showWarning } = useToast();

  // Check user authentication
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showError("Please upload an image file");
      return;
    }

    setImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);

    // Upload image to server
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/scenes/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          // User not authenticated
          showError("Please login to upload images");
          // Save current page for redirect after login
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('loginRedirectUrl', window.location.pathname);
          }
          router.push('/login?from=' + encodeURIComponent('/image-to-music-video'));
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Image upload failed');
      }

      const result = await response.json();
      if (result.success && result.data?.url) {
        setImageUrl(result.data.url);
        showSuccess("Image uploaded successfully");
      } else {
        throw new Error(result.error || 'Image upload failed');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      if (error instanceof Error && !error.message.includes('login')) {
        showError(error.message || 'Image upload failed');
      }
      setImageFile(null);
      setImagePreview(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Handle audio upload
  const handleAudioUpload = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      showError("Please upload an audio file");
      return;
    }

    setAudioFile(file);
    const preview = URL.createObjectURL(file);
    setAudioPreview(preview);

    // Get audio duration
    const audio = new Audio(preview);
    audio.addEventListener('loadedmetadata', async () => {
      const duration = audio.duration;
      setAudioDuration(duration);

      // Upload audio to server
      setIsUploadingAudio(true);
      try {
        // Read file as base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64 = reader.result as string;
            const base64Data = base64.split(',')[1]; // Remove data:audio/...;base64, prefix

            const response = await fetch('/api/music/upload-audio', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                audioBase64: base64Data,
                format: file.name.split('.').pop() || 'mp3',
              }),
            });

            if (!response.ok) {
              throw new Error('Audio upload failed');
            }

            const result = await response.json();
            if (result.success && result.data?.url) {
              setAudioUrl(result.data.url);
              showSuccess("Audio uploaded successfully");

              // If audio is longer than 10 seconds, auto-split
              if (duration > 10) {
                showWarning(`Audio length is ${duration.toFixed(1)} seconds. Auto-split into 10-second segments.`);
                await splitAudio(result.data.url, duration);
              } else {
                // If 10 seconds or less, create a single segment
                setAudioSegments([{
                  id: 'segment-0',
                  start: 0,
                  end: duration,
                  audioUrl: result.data.url,
                  isPlaying: false,
                }]);
                setSelectedSegmentIndex(0);
              }
            } else {
              throw new Error(result.error || 'Audio upload failed');
            }
          } catch (error) {
            console.error('Audio upload error:', error);
            showError(error instanceof Error ? error.message : 'Audio upload failed');
            setAudioFile(null);
            setAudioPreview(null);
          } finally {
            setIsUploadingAudio(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Audio upload error:', error);
        showError(error instanceof Error ? error.message : 'Audio upload failed');
        setIsUploadingAudio(false);
      }
    });
  };

  // Split audio into 10-second segments
  const splitAudio = async (audioUrl: string, duration: number) => {
    const segments: AudioSegment[] = [];
    const segmentDuration = 10; // 10 seconds per segment
    
    for (let start = 0; start < duration; start += segmentDuration) {
      const end = Math.min(start + segmentDuration, duration);
      segments.push({
        id: `segment-${segments.length}`,
        start,
        end,
        audioUrl,
        isPlaying: false,
      });
    }

    setAudioSegments(segments);
    if (segments.length > 0) {
      setSelectedSegmentIndex(0); // Default to first segment
    }
  };

  // Play/pause audio segment
  const toggleSegmentPlayback = useCallback((segment: AudioSegment) => {
    // Stop all other audio
    segmentAudioRefs.current.forEach((audio, id) => {
      if (id !== segment.id) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    // Get or create audio element
    let audio = segmentAudioRefs.current.get(segment.id);
    if (!audio) {
      audio = new Audio(segment.audioUrl);
      const audioElement = audio; // Store in const for closure
      
      // Listen for time updates, stop when reaching end time
      const timeUpdateHandler = () => {
        if (audioElement.currentTime >= segment.end) {
          audioElement.pause();
          audioElement.currentTime = segment.start;
          setAudioSegments(prev => prev.map(s => 
            s.id === segment.id ? { ...s, isPlaying: false } : s
          ));
        }
      };
      
      audioElement.addEventListener('timeupdate', timeUpdateHandler);
      audioElement.addEventListener('ended', () => {
        setAudioSegments(prev => prev.map(s => 
          s.id === segment.id ? { ...s, isPlaying: false } : s
        ));
      });
      
      segmentAudioRefs.current.set(segment.id, audioElement);
    }

    const isCurrentlyPlaying = segment.isPlaying;

    // Update all segments' state
    setAudioSegments(prev => prev.map(s => ({
      ...s,
      isPlaying: s.id === segment.id ? !isCurrentlyPlaying : false,
    })));

    if (!isCurrentlyPlaying) {
      // Start playing
      audio.currentTime = segment.start;
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
        showError('Failed to play audio');
        setAudioSegments(prev => prev.map(s => 
          s.id === segment.id ? { ...s, isPlaying: false } : s
        ));
      });
    } else {
      // Pause playback
      audio.pause();
    }
  }, [showError]);

  // Generate video
  const handleGenerate = async () => {
    if (!imageUrl) {
      showError("Please upload an image first");
      return;
    }

    if (!audioUrl) {
      showError("Please upload an audio file first");
      return;
    }

    if (!prompt.trim()) {
      showError("Please enter a video description");
      return;
    }

    const selectedSegment = selectedSegmentIndex !== null 
      ? audioSegments[selectedSegmentIndex] 
      : null;

    if (!selectedSegment) {
      showError("Please select an audio segment");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/image-to-music-video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          audioUrl,
          prompt,
          audioStartTime: selectedSegment.start,
          audioEndTime: selectedSegment.end,
          duration: selectedSegment.end - selectedSegment.start,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Video generation failed');
      }

      const result = await response.json();
      if (result.success && result.data?.videoUrl) {
        setGeneratedVideoUrl(result.data.videoUrl);
        showSuccess("Video generated successfully!");
      } else {
        throw new Error(result.error || 'Video generation failed');
      }
    } catch (error) {
      console.error('Generate video error:', error);
      showError(error instanceof Error ? error.message : 'Video generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">
                Image to Music Video
              </h1>
              <p className="text-gray-400">
                Upload an image and audio, add a description, and create your music video
              </p>
            </div>

            {/* Upload section - Image and Audio in one row with fixed size */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <div className="grid grid-cols-2 gap-6">
                {/* Image upload area */}
                <div className="flex flex-col">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Upload Image
                  </h2>
                  <div className="w-full h-48 flex-shrink-0">
                    {imagePreview ? (
                      <div className="relative w-full h-full">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                            setImageUrl(null);
                          }}
                          className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 rounded-full p-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-yellow-400 transition-colors bg-gray-800/30">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                          disabled={isUploadingImage}
                        />
                        {isUploadingImage ? (
                          <Loader2 className="w-8 h-8 animate-spin text-yellow-400 mb-2" />
                        ) : (
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        )}
                        <span className="text-sm text-gray-400 text-center px-2">
                          {isUploadingImage ? 'Uploading...' : 'Click to upload image'}
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Audio upload area */}
                <div className="flex flex-col">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Music className="w-5 h-5" />
                    Upload Audio
                  </h2>
                  <div className="w-full h-48 flex-shrink-0">
                    {audioPreview ? (
                      <div className="space-y-4 flex flex-col h-full overflow-hidden">
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <audio
                            ref={audioRef}
                            src={audioPreview}
                            controls
                            className="flex-1"
                          />
                          <button
                            onClick={() => {
                              setAudioFile(null);
                              setAudioPreview(null);
                              setAudioUrl(null);
                              setAudioDuration(0);
                              setAudioSegments([]);
                              setSelectedSegmentIndex(null);
                              segmentAudioRefs.current.clear();
                            }}
                            className="bg-red-500 hover:bg-red-600 rounded-full p-2 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {audioDuration > 0 && (
                          <p className="text-sm text-gray-400 flex-shrink-0">
                            Duration: {audioDuration.toFixed(1)}s
                          </p>
                        )}

                        {/* Audio segment selection */}
                        {audioSegments.length > 0 && (
                          <div className="flex-1 overflow-y-auto min-h-0">
                            {audioSegments.length > 1 ? (
                              <p className="text-sm text-yellow-400 mb-2">
                                Audio exceeds 10 seconds. Auto-split into segments. Select a segment:
                              </p>
                            ) : (
                              <p className="text-sm text-gray-400 mb-2">
                                Audio Segment:
                              </p>
                            )}
                            <div className="grid grid-cols-1 gap-2">
                              {audioSegments.map((segment, index) => (
                                <div
                                  key={segment.id}
                                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                    selectedSegmentIndex === index
                                      ? 'border-yellow-400 bg-yellow-400/10'
                                      : 'border-gray-600 hover:border-gray-500'
                                  }`}
                                  onClick={() => setSelectedSegmentIndex(index)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium">
                                        {audioSegments.length > 1 ? `Segment ${index + 1}` : 'Full Audio'}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        {segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s
                                      </p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSegmentPlayback(segment);
                                      }}
                                      className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
                                    >
                                      {segment.isPlaying ? (
                                        <Pause className="w-4 h-4" />
                                      ) : (
                                        <Play className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-yellow-400 transition-colors bg-gray-800/30">
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleAudioUpload(file);
                          }}
                          disabled={isUploadingAudio}
                        />
                        {isUploadingAudio ? (
                          <Loader2 className="w-8 h-8 animate-spin text-yellow-400 mb-2" />
                        ) : (
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        )}
                        <span className="text-sm text-gray-400 text-center px-2">
                          {isUploadingAudio ? 'Uploading...' : 'Click to upload audio'}
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Text input area */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <h2 className="text-xl font-semibold mb-4">Video Description</h2>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter a video description, e.g., A vibrant city nightscape with neon lights flickering and vehicles passing by..."
                className="min-h-[120px] bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              />
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!imageUrl || !audioUrl || !prompt.trim() || isGenerating || selectedSegmentIndex === null}
              className="w-full bg-gradient-to-r from-yellow-400 to-amber-400 text-black hover:from-yellow-300 hover:to-amber-300 font-semibold py-6 text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5 mr-2" />
                  Generate Music Video
                </>
              )}
            </Button>

            {/* Generated video */}
            {generatedVideoUrl && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-900 rounded-lg p-6 border border-gray-800"
              >
                <h2 className="text-xl font-semibold mb-4">Generated Video</h2>
                <video
                  src={generatedVideoUrl}
                  controls
                  className="w-full rounded-lg"
                />
                <div className="mt-4 flex gap-2">
                  <Button
                    asChild
                    className="bg-yellow-400 text-black hover:bg-yellow-300"
                  >
                    <a href={generatedVideoUrl} download>
                      Download Video
                    </a>
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

