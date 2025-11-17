import { Metadata } from "next";
import VideoEditor from "@/components/storyboard/video-editor";

export const metadata: Metadata = {
  title: "制作视频 | AI Animation Generator",
  description: "编辑和制作您的动画视频",
  robots: {
    index: false,
  },
};

export default function VideoProductionPage() {
  return <VideoEditor />;
}

