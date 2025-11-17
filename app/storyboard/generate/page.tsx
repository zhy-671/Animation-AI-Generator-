import { Metadata } from "next";
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
  return <StoryScriptPage />;
}

