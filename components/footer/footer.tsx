import Link from "next/link";
import Logo from "@/components/logo";

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-black">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="flex flex-col items-center gap-6">
          <Logo />
          <p className="text-sm text-gray-400 text-center">
            © {new Date().getFullYear()} Animation AI Generator. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/ai-disclosure" className="hover:text-white transition-colors">
              AI Disclosure
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/faq" className="hover:text-white transition-colors">
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

