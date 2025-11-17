import { useState, useRef, useEffect } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import ReactCountryFlag from "react-country-flag";

export interface Language {
  code: string;
  name: string;
  flag?: string;
}

interface LanguageSelectProps {
  selectedCountry: string;
  onSelect: (country: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  languages: Language[];
}

function FlagPreloader({ languages }: { languages: Language[] }) {
  return (
    <div className="absolute -top-[9999px] left-0 pointer-events-none">
      {languages.map((language) => (
        <ReactCountryFlag
          key={language.code}
          countryCode={language.code}
          svg
          style={{ width: "1.05rem", height: "1.05rem" }}
        />
      ))}
    </div>
  );
}

export function LanguageSelect({
  selectedCountry,
  onSelect,
  containerRef,
  languages,
}: LanguageSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(
    languages.find((lang) => lang.code === selectedCountry) || null
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lang = languages.find((l) => l.code === selectedCountry);
    setSelectedLanguage(lang || null);
  }, [selectedCountry, languages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, containerRef]);

  const handleSelect = (code: string) => {
    onSelect(code);
    setIsOpen(false);
  };

  return (
    <>
      <FlagPreloader languages={languages} />
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 w-full text-left bg-background border border-input rounded-md hover:bg-accent transition-colors",
            isOpen && "ring-2 ring-ring"
          )}
        >
          {selectedLanguage ? (
            <>
              {selectedLanguage.code === "auto" ? (
                <Globe className="h-4 w-4" />
              ) : (
                <ReactCountryFlag
                  countryCode={selectedLanguage.code}
                  svg
                  style={{ width: "1.05rem", height: "1.05rem" }}
                />
              )}
              <span className="flex-1 text-sm">{selectedLanguage.name}</span>
            </>
          ) : (
            <>
              <Globe className="h-4 w-4" />
              <span className="flex-1 text-sm">Auto-detect</span>
            </>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            <div className="p-1">
              <button
                type="button"
                onClick={() => handleSelect("auto")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 w-full text-left rounded-sm hover:bg-accent transition-colors",
                  selectedCountry === "auto" && "bg-accent"
                )}
              >
                <Globe className="h-4 w-4" />
                <span className="text-sm">Auto-detect</span>
              </button>
              {languages.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => handleSelect(language.code)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 w-full text-left rounded-sm hover:bg-accent transition-colors",
                    selectedCountry === language.code && "bg-accent"
                  )}
                >
                  <ReactCountryFlag
                    countryCode={language.code}
                    svg
                    style={{ width: "1.05rem", height: "1.05rem" }}
                  />
                  <span className="text-sm">{language.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}

