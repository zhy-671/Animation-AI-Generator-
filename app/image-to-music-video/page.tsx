import { Metadata } from "next";
import ImageToMusicVideoForm from "@/components/image-to-music-video/image-to-music-video-form";

export const metadata: Metadata = {
  title: "Image to Music Video - Create Music Videos from Images | animationaIgenerator",
  description: "Upload an image and audio, then generate a music video with AI. Transform your images into dynamic music videos with custom audio tracks.",
  keywords: [
    "image to music video",
    "music video generator",
    "create music video from image",
    "AI music video",
    "image animation with music",
    "video generator with audio"
  ],
  alternates: {
    canonical: "/image-to-music-video",
  },
  openGraph: {
    title: "Image to Music Video - Create Music Videos from Images",
    description: "Upload an image and audio, then generate a music video with AI.",
    type: "website",
  },
};

export default function ImageToMusicVideoPage() {
  return <ImageToMusicVideoForm />;
}

