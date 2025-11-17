"use client";

import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Lightbulb, FileText, Camera, Zap, Sparkles } from "lucide-react";
import { useState } from "react";

export default function PromptGuidePage() {
  const [videoErrors, setVideoErrors] = useState<Set<string>>(new Set());

  const handleVideoError = (videoSrc: string) => {
    setVideoErrors((prev) => new Set(prev).add(videoSrc));
  };

  const VideoPlayer = ({ src, alt }: { src: string; alt: string }) => {
    const hasError = videoErrors.has(src);
    
    if (hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
          <div className="text-center p-4">
            <Camera className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Video failed to load</p>
          </div>
        </div>
      );
    }

    return (
      <video 
        className="w-full h-full object-cover" 
        controls
        playsInline
        preload="metadata"
        onError={() => handleVideoError(src)}
      >
        <source src={src} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-16 md:py-24 flex-grow">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Prompt Guide
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              A Prompt is the core instruction that describes the video you want to generate. Writing effective Prompts is key to obtaining high-quality, coherent, and visually appealing videos. This guide covers Prompt writing techniques for both text-to-video and image-to-video modes.
            </p>
          </div>

          {/* Introduction */}
          <Card className="bg-gradient-to-br from-[#FFDA2A]/10 to-transparent border-[#FFDA2A]/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#FFDA2A]" />
                Intelligent Prompt Enhancement (prompt_extend)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Enable intelligent prompt enhancement. The default value is <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">true</code>, and it is recommended to keep it enabled for optimal results.
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
 
              </div>
            </CardContent>
          </Card>

          {/* Prompt Composition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Prompt Composition Structure
              </CardTitle>
              <CardDescription>
                A well-designed Prompt can simultaneously control both the content and motion of the video. Depending on your experience and creative needs, Prompts can be simple or highly detailed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Formula */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#FFDA2A]" />
                  Basic Formula
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  <strong className="text-gray-900 dark:text-white">Use Case:</strong> Beginners or users seeking inspiration
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Prompt = Subject + Scene + Motion
                  </p>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li><strong className="text-gray-900 dark:text-white">Subject:</strong> The main element of the video (person, animal, plant, object, or imaginary entity)</li>
                    <li><strong className="text-gray-900 dark:text-white">Scene:</strong> The environment, including background and foreground, real or imagined</li>
                    <li><strong className="text-gray-900 dark:text-white">Motion:</strong> Movement of the subject or environment (static, subtle, dynamic, or overall motion)</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Text-to-Video Example:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A black-haired girl wearing a mechanical hanfu, her hair styled in a bun, turns to face the camera, her soft, shiny hair flowing gracefully in the air."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Image-to-Video Example:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A man soaring in a paraglider"
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Formula */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#FFDA2A]" />
                  Advanced Formula
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  <strong className="text-gray-900 dark:text-white">Use Case:</strong> Experienced users seeking higher quality, story-driven videos
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Prompt = Subject (Details) + Scene (Details) + Motion (Details) + Cinematography + Mood + Style
                  </p>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li><strong className="text-gray-900 dark:text-white">Subject Details:</strong> Appearance, clothing, unique characteristics</li>
                    <li><strong className="text-gray-900 dark:text-white">Scene Details:</strong> Detailed description of the surrounding environment</li>
                    <li><strong className="text-gray-900 dark:text-white">Motion Details:</strong> Amplitude, speed, and effect of movement</li>
                    <li><strong className="text-gray-900 dark:text-white">Cinematography:</strong> Shot type, camera angle, lens, camera movement</li>
                    <li><strong className="text-gray-900 dark:text-white">Mood:</strong> Emotional atmosphere (dreamy, calm, tense, lively, etc.)</li>
                    <li><strong className="text-gray-900 dark:text-white">Style:</strong> Visual style (anime, cyberpunk, illustration, classical art, pixel game, etc.)</li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Example:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    "A black-haired Miao girl wearing traditional ethnic clothing, carrying a pair of wings made of crushed stone, glides over a desolate landscape. The camera follows her flight, rising into the sky, showing the contrast between her graceful figure and the wasteland, emphasizing the contrast between her elegance and the harsh environment."
                  </p>
                </div>
              </div>

              {/* Camera Motion Formula */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#FFDA2A]" />
                  Camera Motion Formula
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  <strong className="text-gray-900 dark:text-white">Use Case:</strong> Professional video output with precise camera movement
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Prompt = Camera Motion + Subject + Scene + Motion + Cinematography + Mood + Style
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    <strong className="text-gray-900 dark:text-white">Camera Motion:</strong> Describe in detail how the camera moves over time. Keep the motion within 5 seconds to ensure clarity.
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Example:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    "The shot begins with an antique wooden screen filling the frame, slowly panning left to reveal a hanfu-clad girl sitting behind the screen, participating in an online meeting, her hair styled in an elaborate bun with exquisite details."
                  </p>
                </div>
              </div>

              {/* Transformation Formula */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#FFDA2A]" />
                  Transformation Formula
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  <strong className="text-gray-900 dark:text-white">Use Case:</strong> Creative effects, transformations, or shape changes
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Prompt = Subject A + Transformation Process + Subject B + Scene + Motion + Cinematography + Mood + Style
                  </p>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li><strong className="text-gray-900 dark:text-white">Subject A:</strong> Initial form</li>
                    <li><strong className="text-gray-900 dark:text-white">Transformation Process:</strong> How it changes</li>
                    <li><strong className="text-gray-900 dark:text-white">Subject B:</strong> Final form</li>
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Example:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    "Anime style, a black cat crouches under a streetlight, gazing at neon lights. A blue light descends and envelops it, elongating its body, transforming its fur into a sleek black suit. The cat ears disappear, facial features emerge, and it finally transforms into a handsome young man landing gracefully, his suit gently flowing in the night breeze."
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seven Key Elements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Seven Key Elements of Prompt Design
              </CardTitle>
              <CardDescription>
                Master these key elements to make your Prompts more professional and effective
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#FFDA2A]" />
                    1. Shot Type (Composition)
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Close-up:</strong> Focus on facial features or small object details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Medium Shot:</strong> Show person/object within their environment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Wide Shot:</strong> Show environment and surroundings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Aerial/Top View:</strong> Overview of the scene</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#FFDA2A]" />
                    2. Camera Angle
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Low Angle:</strong> Emphasize height or power</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">High Angle/Top View:</strong> Show vulnerability or overview</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">First Person/Drone View:</strong> Immersive first-person perspective</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#FFDA2A]" />
                    3. Lens/Perspective
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Fisheye:</strong> Curved, exaggerated wide angle</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Wide Angle:</strong> Capture more scene, expansive view</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#FFDA2A]" />
                    4. Camera Movement
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Dolly In:</strong> Move closer to subject</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Dolly Out:</strong> Move away from subject</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Pan/Track/Orbit:</strong> Follow or rotate around subject</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#FFDA2A]" />
                    5. Motion Speed
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>Slow motion / Fast motion / Time-lapse</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>Control visual impact and narrative rhythm</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#FFDA2A]" />
                    6. Mood/Atmosphere
                  </h3>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>Lively / Joyful / Beautiful</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>Dreamy / Calm / Soft</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>Lonely / Quiet / Melancholic</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>Tense / Uneasy / Gloomy</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>Grand / Powerful / Majestic</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#FFDA2A]" />
                  7. Visual Style
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Cyberpunk:</strong> Neon lights, futuristic cityscapes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Post-apocalyptic:</strong> Desolate, imaginative</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Line Art/Illustration:</strong> Stylized, clear outlines</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Anime/Cartoon:</strong> Classic or modern animation style</span>
                    </li>
                  </ul>
                  <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Felt/Toy-like:</strong> Cute, handcrafted appearance</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Classical Painting:</strong> Imitating Van Gogh, Monet, etc.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span><strong className="text-gray-900 dark:text-white">Pixel/Game:</strong> Retro pixel graphics, high-resolution textures</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Camera Angles & Perspectives */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#FFDA2A]" />
                Camera Angles & Perspectives
              </CardTitle>
              <CardDescription>
                Master different camera angles and lens perspectives to make your videos more visually impactful and narratively expressive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Low Angle */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Low Angle
                </h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "The video begins with a pair of walking legs, shot from a low angle, focusing on the movement of footsteps. In the frame, shoes tread on rough abandoned ground, surrounded by broken concrete and scattered weeds, showcasing the desolation and decay of a post-apocalyptic style."
                      </p>
                    </div>
                    {/* Video Display Area */}
                    <div className="mt-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <div className="relative aspect-video">
                        <VideoPlayer 
                          src="https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250109/pbxdzt/%E6%96%87%E7%94%9F%E8%A7%86%E9%A2%91_%E4%BD%8E%E8%A7%92%E5%BA%A6.mp4" 
                          alt="Low angle example video" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close-up */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Close-up
                </h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Close-up shot focusing on the girl's eyes, filled with anticipation"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Medium Shot */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Medium Shot
                </h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Medium shot showing a person's complete posture in a coffee shop"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wide Shot */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Wide Shot
                </h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Wide-angle shot showing the entire city skyline and streets"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aerial/Top View */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Aerial/Top View
                </h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Aerial view overlooking the entire square and surrounding buildings"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top-down Shot */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Top-down Shot
                </h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "The video shows a scene of a person walking in a post-apocalyptic world. The camera shoots from above, capturing a person walking slowly forward in a wasteland-style scene with sunlight."
                      </p>
                    </div>
                    {/* Video Display Area */}
                    <div className="mt-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <div className="relative aspect-video">
                        <VideoPlayer 
                          src="https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250109/aufdzs/%E6%96%87%E7%94%9F%E8%A7%86%E9%A2%91_%E4%BF%AF%E6%8B%8D.mp4" 
                          alt="Top-down shot example video" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drone */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Drone
                </h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "FPV drone perspective | At the start of the video, the camera uses FPV (first-person view) drone shooting, creating an immersive experience. The camera rapidly weaves through tall buildings in the city, showcasing magnificent urban landscapes. Buildings flash by in the field of view, with light and shadow interweaving, reflecting the modernity and prosperity of the city."
                      </p>
                    </div>
                    {/* Video Display Area */}
                    <div className="mt-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <div className="relative aspect-video">
                        <VideoPlayer 
                          src="https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250109/vdukia/%E6%96%87%E7%94%9F%E8%A7%86%E9%A2%91_%E6%97%A0%E4%BA%BA%E6%9C%BA.mp4" 
                          alt="Drone example video" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Camera Angles */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Camera Angles
                </h3>
                <div className="space-y-4">
                  {/* High Angle/Top View */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">High Angle/Top View (High Angle)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Top-down angle showing the smallness of a person in a vast scene"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* Eye Level */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Eye Level (Eye Level)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Eye-level angle, character dialogue scene, natural and friendly"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* First Person/Drone View */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">First Person/Drone View (POV/Drone)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "First-person perspective, traversing a forest path, immersive"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lens/Perspective */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Lens/Perspective
                </h3>
                <div className="space-y-4">
                  {/* Fisheye */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Fisheye (Fisheye)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Fisheye lens, street showing curved visual effects"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* Wide Angle */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Wide Angle (Wide Angle)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Wide-angle lens showing the layout and details of the entire room"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* Standard */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Standard (Standard)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Standard lens, natural scene presentation, no distortion"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* Telephoto */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Telephoto (Telephoto)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Telephoto lens, clear subject, blurred background"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Camera Movement */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Camera Movement
                </h3>
                <div className="space-y-4">
                  {/* Dolly In */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Dolly In (Dolly In)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Camera slowly moves in, focusing on the character's expression changes"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* Dolly Out */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Dolly Out (Dolly Out)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Camera slowly pulls back, showing the environment where the character is"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* Pan */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Pan (Pan)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Camera pans from left to right, showing the city skyline"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* Tracking */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Tracking (Tracking)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Camera follows the character walking, keeping the character centered in the frame"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* Orbit */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Orbit (Orbit)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Camera rotates 360 degrees around a sculpture, showing the full view"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>

                  {/* Crane/Tilt */}
                  <div className="border-l-4 border-[#FFDA2A] pl-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Crane/Tilt (Crane/Tilt)</h4>
                    <div className="space-y-2 mb-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Prompt Example:</p>
                      <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                        "Camera rises from the ground, showing the full view of the building"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Video Effect:</p>
                      <p className="text-gray-600 dark:text-gray-400">
                        {/* Video effect content to be filled */}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Style Examples */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Style Types, Prompt Examples & Video Effects
              </CardTitle>
              <CardDescription>
                Prompt examples for different style types and their corresponding video effects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 2D Animation Style */}
              <div className="border-l-4 border-[#FFDA2A] pl-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  2D Animation Style
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 1:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "An orange kitten running on a sunny grassy field, with butterflies fluttering around. 2D animation style, vibrant colors, smooth lines, full of childlike charm and vitality."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 2:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A flower shop with exquisite windows, beautiful wooden doors, and neatly arranged flowers. The camera slowly pushes in, showcasing the warm atmosphere of the flower shop. 2D flat style, soft colors, simple lines."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Video Effect:</p>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Generates videos with traditional 2D animation texture, featuring flat visuals, high color saturation, smooth and natural motion, suitable for creating cartoons, children's content, or lighthearted scenes.
                    </p>
                    <ul className="text-gray-600 dark:text-gray-400 text-sm space-y-1 ml-4 list-disc">
                      <li>Flat design visuals with no three-dimensional shadow effects</li>
                      <li>High color saturation with distinct contrast</li>
                      <li>Smooth and natural motion, suitable for lighthearted scenes</li>
                      <li>Simple and clear lines, suitable for educational or children's content</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Use Cases:</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Children's educational videos, brand promotional animations, social media short videos, product demonstration animations
                    </p>
                  </div>
                </div>
              </div>

              {/* 3D Animation Style */}
              <div className="border-l-4 border-[#FFDA2A] pl-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  3D Animation Style
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 1:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A robot standing on the rooftop of a futuristic city, overlooking streets with flickering neon lights. 3D rendering style, exquisite details, realistic lighting effects, full of technological sense."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 2:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A 3D cartoon bear cub walking through a forest, with sunlight filtering through leaves creating dappled shadows. The camera follows the bear, showcasing the three-dimensional sense of the surrounding environment. 3D animation style, soft lighting, rich details."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Video Effect:</p>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Generates videos with three-dimensional depth, where objects have depth and volume, with realistic lighting effects, suitable for creating sci-fi, gaming, or scenes requiring three-dimensional sense.
                    </p>
                    <ul className="text-gray-600 dark:text-gray-400 text-sm space-y-1 ml-4 list-disc">
                      <li>Objects have obvious three-dimensional depth and volume</li>
                      <li>Realistic lighting effects with contrast between light and shadow</li>
                      <li>Rich details with clear textures</li>
                      <li>Suitable for sci-fi, gaming, product showcases, and other scenes</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Use Cases:</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Game promotional videos, product 3D showcases, sci-fi short films, architectural visualization, VR/AR content
                    </p>
                  </div>
                </div>
              </div>

              {/* Anime Style */}
              <div className="border-l-4 border-[#FFDA2A] pl-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Japanese Anime Style
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 1:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A black-haired girl wearing a mechanical hanfu, her hair styled in a bun, turns to face the camera, her soft, shiny hair flowing gracefully in the air. Japanese anime style, large eyes, delicate lines, soft colors."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 2:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A campus scene with cherry blossoms fluttering, a schoolgirl in uniform standing under a cherry tree, the breeze lifting her long hair and skirt. Japanese anime style, beautiful visuals, soft tones, full of youthful atmosphere."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Video Effect:</p>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Generates videos with Japanese anime characteristics, featuring distinctive character traits (large eyes, delicate features), beautiful visual style, soft colors, suitable for creating anime-style content.
                    </p>
                    <ul className="text-gray-600 dark:text-gray-400 text-sm space-y-1 ml-4 list-disc">
                      <li>Characters have typical Japanese anime features: large eyes, delicate facial features</li>
                      <li>Beautiful visual style with soft colors, full of poetic atmosphere</li>
                      <li>Delicate and smooth lines with rich details</li>
                      <li>Suitable for themes like youth, romance, fantasy, etc.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Use Cases:</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Anime short films, MV production, game character showcases, anime culture content, brand image videos
                    </p>
                  </div>
                </div>
              </div>

              {/* Cyberpunk Style */}
              <div className="border-l-4 border-[#FFDA2A] pl-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Cyberpunk Style
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 1:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "Urban streets at night, neon lights flickering, raindrops sliding down glass. Cyberpunk style, high contrast, blue-purple tones, full of futuristic and technological sense."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 2:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A scene of urban fantasy art. A dynamic graffiti art character. A boy painted with spray paint is coming to life from a concrete wall. He's rapping an English rap at an extremely fast pace while striking a classic, energetic rapper pose. The scene is set under an urban railway bridge at night. Light comes from a lone streetlamp, creating a cinematic atmosphere full of high energy and amazing details."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Video Effect:</p>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Generates videos with cyberpunk aesthetic features, featuring intense neon lighting effects, high-contrast colors (blue-purple, pink), creating a futuristic, technology-heavy atmosphere.
                    </p>
                    <ul className="text-gray-600 dark:text-gray-400 text-sm space-y-1 ml-4 list-disc">
                      <li>Intense neon lighting effects, primarily blue-purple tones</li>
                      <li>High-contrast colors with strong light-dark contrast</li>
                      <li>Futuristic style, full of technological sense</li>
                      <li>Suitable for urban, sci-fi, dystopian themes</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Use Cases:</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Sci-fi short films, game promotions, music videos, tech product showcases, brand image videos
                    </p>
                  </div>
                </div>
              </div>

              {/* Clay Animation Style */}
              <div className="border-l-4 border-[#FFDA2A] pl-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Clay Animation Style
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 1:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A cute little bear playing in the forest, surrounded by various small animals. Clay animation style, soft texture, warm colors, full of handcrafted warmth."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 2:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A little boy and a little girl planting flowers in a garden, carefully digging soil, sowing seeds, and watering. Clay animation style, soft texture, warm tones, full of innocence and warmth."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Video Effect:</p>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Generates videos with clay animation texture, featuring soft surface textures, warm colors, slightly clumsy but fun movements, suitable for creating children's content or warm scenes.
                    </p>
                    <ul className="text-gray-600 dark:text-gray-400 text-sm space-y-1 ml-4 list-disc">
                      <li>Objects display soft clay texture on surfaces</li>
                      <li>Warm colors, full of handcrafted warmth</li>
                      <li>Slightly clumsy movements but full of fun and innocence</li>
                      <li>Suitable for warm, childlike, educational themes</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Use Cases:</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Children's educational videos, brand promotions, public service advertisements, warm story short films, product showcases
                    </p>
                  </div>
                </div>
              </div>

              {/* Comic Style */}
              <div className="border-l-4 border-[#FFDA2A] pl-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  American Comic Style
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 1:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A superhero standing on a city rooftop, cape fluttering in the wind. American comic style, bold lines, high contrast, vibrant colors, full of power."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 2:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "An epic and adorable scene. A small, cute cartoon kitten general, wearing exquisitely detailed golden armor and a slightly oversized helmet, bravely stands on a cliff. He rides a small but heroic warhorse. Below the cliff, an army of countless mice charges forward with makeshift weapons. This is a dramatic, large-scale battle scene inspired by ancient Chinese war epics. Dark clouds gather over the distant snowy mountains. The overall atmosphere is a humorous and epic fusion of 'cuteness' and 'majesty'."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Video Effect:</p>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Generates videos with American comic characteristics, featuring bold lines, strong color contrast, dynamic and powerful visuals, suitable for creating superhero or action scenes.
                    </p>
                    <ul className="text-gray-600 dark:text-gray-400 text-sm space-y-1 ml-4 list-disc">
                      <li>Bold lines with strong visual impact</li>
                      <li>High-contrast colors with distinct light-dark contrast</li>
                      <li>Dynamic and powerful visuals</li>
                      <li>Suitable for action, adventure, heroism themes</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Use Cases:</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Superhero short films, action scenes, game promotions, brand image videos, comic adaptations
                    </p>
                  </div>
                </div>
              </div>

              {/* Cartoon Style */}
              <div className="border-l-4 border-[#FFDA2A] pl-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Cartoon Style
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 1:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "A group of small animals throwing a party in the forest, music playing, everyone dancing joyfully. Cartoon animation style, exaggerated expressions, smooth movements, full of joyful atmosphere."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prompt Example 2:</p>
                    <p className="text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded">
                      "An orange kitten running on a sunny grassy field, with butterflies fluttering around. Cartoon animation style, vibrant colors, smooth lines, full of childlike charm and vitality."
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Video Effect:</p>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Generates videos with classic cartoon animation characteristics, featuring exaggerated and smooth movements, rich expressions, bright colors, suitable for creating lighthearted and energetic content.
                    </p>
                    <ul className="text-gray-600 dark:text-gray-400 text-sm space-y-1 ml-4 list-disc">
                      <li>Exaggerated and smooth movements with rich and vivid expressions</li>
                      <li>Bright and vibrant colors, full of energy</li>
                      <li>Simple and smooth lines with a lighthearted style</li>
                      <li>Suitable for joyful, childlike, relaxed themes</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Use Cases:</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      Children's animation, brand promotions, social media content, educational videos, entertainment short films
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-[#FFDA2A]" />
                Usage Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900 dark:text-white">Start with Basic Formula:</strong>
                    <p className="text-gray-600 dark:text-gray-400">
                      For rapid prototyping and initial attempts
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900 dark:text-white">Use Advanced/Camera Movement/Transformation Formulas:</strong>
                    <p className="text-gray-600 dark:text-gray-400">
                      For detailed storytelling and professional video production
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900 dark:text-white">Combine Elements:</strong>
                    <p className="text-gray-600 dark:text-gray-400">
                      Combining Scene + Subject + Motion + Mood + Style can create consistent and emotionally resonant videos
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900 dark:text-white">Length Control:</strong>
                    <p className="text-gray-600 dark:text-gray-400">
                      wan2.5 series models support up to 2000 characters, wan2.2 and below versions support up to 800 characters. Excess content will be automatically truncated.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-gray-900 dark:text-white">Use Negative Prompts:</strong>
                    <p className="text-gray-600 dark:text-gray-400">
                      Use negative_prompt to exclude unwanted elements, such as "low resolution, errors, worst quality, low quality, incomplete, extra fingers, bad proportions, etc."
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
