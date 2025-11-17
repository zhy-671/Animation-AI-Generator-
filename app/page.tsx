import { Metadata } from "next";
import HomeClient from "@/components/home/home-client";

export const metadata: Metadata = {
  title: "Animation AI Generator & Video Maker | Animaker AI | Create 2D & 3D Animations",
  description: "Create stunning animated videos with our AI-powered 2D and 3D animation tools. Optimized for short-form video creators on TikTok, Reels, and more. Try Animation AI Generator free today!",
};

export default function Home() {
  return <HomeClient />;
}
