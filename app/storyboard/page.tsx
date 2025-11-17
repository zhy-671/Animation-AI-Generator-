import { Metadata } from "next";
import StoryboardProjectsList from "@/components/storyboard/projects-list";

export const metadata: Metadata = {
  title: "Story Script Creator | AI Animation Generator",
  description: "Create detailed story scripts with AI-powered scene generation. Manage your storyboard projects and bring your creative ideas to life.",
  openGraph: {
    title: "Story Script Creator | AI Animation Generator",
    description: "Create detailed story scripts with AI-powered scene generation",
    type: "website",
  },
};

export default function StoryboardPage() {
  return <StoryboardProjectsList />;
}
