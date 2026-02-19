"use client";

import React, { useRef, useState, useEffect } from "react";

interface AudioProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  className?: string;
  showTime?: boolean;
}

export default function AudioProgressBar({
  currentTime,
  duration,
  onSeek,
  className = "",
  showTime = true,
}: AudioProgressBarProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || duration === 0) return;
    setIsDragging(true);
    handleSeek(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !onSeek || duration === 0) return;
    handleSeek(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !onSeek || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!progressRef.current || !onSeek || duration === 0) return;
        const rect = progressRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const newTime = percentage * duration;
        onSeek(newTime);
      };

      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };

      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleGlobalMouseMove);
        window.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDragging, onSeek, duration]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showTime && (
        <span className="text-xs text-gray-400 min-w-[40px] text-right">
          {formatTime(currentTime)}
        </span>
      )}
      <div
        ref={progressRef}
        className="flex-1 h-1.5 bg-gray-700 rounded-full cursor-pointer relative group"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="h-full bg-[#FFDA2A] rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-[#FFDA2A] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>
      {showTime && (
        <span className="text-xs text-gray-400 min-w-[40px]">
          {formatTime(duration)}
        </span>
      )}
    </div>
  );
}

