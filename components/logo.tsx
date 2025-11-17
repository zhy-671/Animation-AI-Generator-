import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src="/images/logo.png"
        alt="Animation AI Generator Logo"
        width={32}
        height={32}
        className="h-8 w-8 object-contain"
        priority
      />
      <span className="text-xl font-bold text-white">
        Animation AI Generator
      </span>
    </Link>
  );
}

