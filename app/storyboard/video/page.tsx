import { Metadata } from "next";
import { Suspense } from "react";
import VideoEditor from "@/components/storyboard/video-editor";

export const metadata: Metadata = {
  title: "image to video | AI Animation Generator",
  description: "Edit and produce your animated videos",
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

