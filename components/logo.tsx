import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src="/images/versemovie-logo.png"
        alt="VerseMovie Logo"
        width={32}
        height={32}
        className="h-8 w-8 object-contain"
        priority
      />
      <span className="text-xl font-bold text-white flex items-baseline">
        <span>VerseMovie</span>
        <span className="text-xs font-normal opacity-80 ml-0.5">-Video AI Music</span>
      </span>
    </Link>
  );
}

