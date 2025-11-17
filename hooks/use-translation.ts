import { useParams } from "next/navigation";
import en from "@/messages/en.json";

export function useTranslation() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  
  const translations: Record<string, any> = {
    en,
  };
  
  const t = translations[locale] || translations.en;
  
  return {
    t,
    locale,
  };
}

