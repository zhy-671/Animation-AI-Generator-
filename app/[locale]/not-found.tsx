import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center space-y-8 max-w-md">
        <div className="space-y-4">
          <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-800">404</h1>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Page not found
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild className="rounded-full">
            <Link href="/en">
              <Home className="w-4 h-4 mr-2" />
              Go home
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/en/generate">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Create animation
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

