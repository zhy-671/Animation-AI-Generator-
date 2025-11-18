import { Metadata } from "next";
import { Suspense } from "react";
import VideoEditor from "@/components/storyboard/video-editor";

export const metadata: Metadata = {
  title: "制作视频 | AI Animation Generator",
  description: "编辑和制作您的动画视频",
  robots: {
    index: false,
  },
};

export default function VideoProductionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <VideoEditor />
    </Suspense>
  );
}

