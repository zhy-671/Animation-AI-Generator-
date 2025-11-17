import { Metadata } from "next";
import PricingPage from "@/components/pricing/pricing-page";

export const metadata: Metadata = {
  title: "Pricing Plans & Credit Packages | Animation AI Generator",
  description: "Flexible pricing for every creator. Choose from monthly subscription plans or pay-as-you-go credits. Generate AI animations, storyboards, and videos.",
};

export default function Pricing() {
  return <PricingPage />;
}

