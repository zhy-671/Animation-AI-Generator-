import { Metadata } from "next";
import AnimationGeneratorForm from "@/components/generator/animation-generator-form";

export const metadata: Metadata = {
  title: "Text to Video | Animation AI Generator",
  description: "Create animated videos from text descriptions. Make animation scenes online with our animation creator. Generate animated shorts in seconds.",
  keywords: "text to video, animation ai generator, ai animation creator, make animation online, create animated short",
};

export default function TextToVideoPage() {
  return (
    <AnimationGeneratorForm />
  );
}

