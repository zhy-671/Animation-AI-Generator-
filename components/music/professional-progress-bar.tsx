"use client";

import React, { useRef, useState, useEffect } from "react";

interface ProfessionalProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  className?: string;
  showTime?: boolean;
  color?: string;
}

export default function ProfessionalProgressBar({
  currentTime,
  duration,
  onSeek,
  className = "",
  showTime = true,
  color = "#FFDA2A",
}: ProfessionalProgressBarProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!progressRef.current || !onSeek || duration === 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    onSeek(newTime);
  };

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
    <div className={`flex items-center gap-3 ${className}`}>
      {showTime && (
        <span className="text-xs font-mono text-gray-400 min-w-[45px] text-right tabular-nums">
          {formatTime(currentTime)}
        </span>
      )}
      <div
        ref={progressRef}
        className="flex-1 h-2 bg-gray-800 rounded-full cursor-pointer relative group"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Background track with subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 rounded-full opacity-50" />
        
        {/* Progress fill with gradient and glow */}
        <div
          className="h-full rounded-full transition-all duration-100 relative overflow-hidden"
          style={{ width: `${progress}%` }}
        >
          {/* Gradient fill */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${color} 0%, ${adjustBrightness(color, 1.2)} 50%, ${color} 100%)`,
            }}
          />
          
          {/* Animated shimmer effect */}
          <div
            className="absolute inset-0 rounded-full opacity-30 animate-shimmer"
            style={{
              background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)`,
            }}
          />
          
          {/* Glow effect */}
          <div
            className="absolute inset-0 rounded-full blur-sm"
            style={{
              background: color,
              opacity: 0.4,
            }}
          />
        </div>
        
        {/* Hover/Active indicator */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all duration-200 ${
            isHovering || isDragging ? "opacity-100 scale-125" : "opacity-0 scale-100"
          }`}
          style={{
            left: `calc(${progress}% - 8px)`,
            background: color,
            boxShadow: `0 0 12px ${color}, 0 0 24px ${color}`,
          }}
        />
        
        {/* Always visible small dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-100"
          style={{
            left: `calc(${progress}% - 4px)`,
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
      {showTime && (
        <span className="text-xs font-mono text-gray-400 min-w-[45px] tabular-nums">
          {formatTime(duration)}
        </span>
      )}
    </div>
  );
}

function adjustBrightness(color: string, factor: number): string {
  const hex = color.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const newR = Math.min(255, Math.floor(r * factor));
  const newG = Math.min(255, Math.floor(g * factor));
  const newB = Math.min(255, Math.floor(b * factor));

  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

