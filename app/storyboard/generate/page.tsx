import { Metadata } from "next";
import { Suspense } from "react";
import StoryScriptPage from "@/components/storyboard/story-script-page";

export const metadata: Metadata = {
  title: "Story Script | AI Animation Generator",
  description: "Create your story script with AI.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GenerateStoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <StoryScriptPage />
    </Suspense>
  );
}

