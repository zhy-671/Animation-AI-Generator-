import { Metadata } from "next";
import MusicGeneratorForm from "@/components/music/music-generator-form";

export const metadata: Metadata = {
  title: "Create AI Music | Animation AI Generator",
  description: "Generate high-quality AI music with our music generator. Create custom music tracks for your videos and animations.",
};

export default function AIMusicVideoGeneratorPage() {
  return <MusicGeneratorForm />;
}

