import { Metadata } from "next";
import { Suspense } from "react";
import StoryScriptPage from "@/components/storyboard/story-script-page";

export const metadata: Metadata = {
  title: "Anime Story | AI Animation Generator-Create your anime story",
  description: "Create your anime story script with AI.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AnimeStoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
      <StoryScriptPage />
    </Suspense>
  );
}

