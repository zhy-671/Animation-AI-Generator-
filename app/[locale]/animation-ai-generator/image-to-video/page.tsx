import { Metadata } from "next";
import AnimationGeneratorForm from "@/components/generator/animation-generator-form";

export const metadata: Metadata = {
  title: "Image to Video | Animation AI Generator",
  description: "Create animated videos from images. Transform static images into dynamic animated scenes. Generate animation videos in seconds.",
  keywords: "image to video, animation ai generator, ai animation creator, make animation online, create animated short",
};

export default function ImageToVideoPage() {
  return (
    <AnimationGeneratorForm />
  );
}

