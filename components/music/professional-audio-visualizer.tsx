"use client";

import React, { useEffect, useRef, useState } from "react";

// Global map to track which audio elements are already connected to AudioContext
const connectedAudioElements = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
// Track audio elements that are currently being connected (to prevent race conditions)
const connectingAudioElements = new WeakSet<HTMLAudioElement>();
// Global map to share analyser nodes for the same audio element
const sharedAnalysers = new WeakMap<HTMLAudioElement, AnalyserNode>();
// Global AudioContext shared across all visualizers
let globalAudioContext: AudioContext | null = null;

// Helper function to draw rounded rectangle (polyfill for roundRect)
const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    // Fallback for browsers that don't support roundRect
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
};

interface ProfessionalAudioVisualizerProps {
  isPlaying: boolean;
  audioElement?: HTMLAudioElement | null;
  className?: string;
  variant?: "bars" | "circle" | "wave";
  color?: string;
  barCount?: number;
}

export default function ProfessionalAudioVisualizer({
  isPlaying,
  audioElement,
  className = "",
  variant = "bars",
  color = "#FFDA2A",
  barCount = 20,
}: ProfessionalAudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioElement || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      drawStatic();
      return;
    }

    // Check if audio element has changed
    const audioElementChanged = audioElementRef.current !== audioElement;
    const previousAudioElement = audioElementRef.current;
    
    // If audio element changed, we need to clean up old connections
    if (audioElementChanged && previousAudioElement && sourceRef.current) {
      try {
        sourceRef.current.disconnect();
        connectedAudioElements.delete(previousAudioElement);
        connectingAudioElements.delete(previousAudioElement);
      } catch (e) {
        // Ignore disconnect errors
      }
      sourceRef.current = null;
    }

    audioElementRef.current = audioElement;

    const setupAudioContext = async () => {
      try {
        if (!audioContextRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          audioContextRef.current = new AudioContextClass();
        }

        const audioContext = audioContextRef.current;

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        if (!analyserRef.current) {
          analyserRef.current = audioContext.createAnalyser();
          analyserRef.current.fftSize = 512;
          analyserRef.current.smoothingTimeConstant = 0.85;
          dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
        }

        // Check if we already have a source for this audio element
        if (sourceRef.current && !audioElementChanged) {
          // Reuse existing source
          setUseFallback(false);
          startVisualization();
          return;
        }

        // Check if audio element is already connected by another component
        const existingSource = connectedAudioElements.get(audioElement);
        const sharedAnalyser = sharedAnalysers.get(audioElement);
        const isConnecting = connectingAudioElements.has(audioElement);
        
        // If audio element is already connected, try to reuse the shared analyser
        if (existingSource && sharedAnalyser && !audioElementChanged) {
          // Use the shared analyser from the existing connection
          analyserRef.current = sharedAnalyser;
          dataArrayRef.current = new Uint8Array(sharedAnalyser.frequencyBinCount);
          setUseFallback(false);
          startVisualization();
          return;
        }
        
        // If currently connecting, wait a bit and try to use shared analyser
        if (isConnecting && !audioElementChanged) {
          setTimeout(() => {
            const retrySharedAnalyser = sharedAnalysers.get(audioElement);
            if (retrySharedAnalyser) {
              analyserRef.current = retrySharedAnalyser;
              dataArrayRef.current = new Uint8Array(retrySharedAnalyser.frequencyBinCount);
              setUseFallback(false);
              startVisualization();
            } else {
              setUseFallback(true);
              startFallbackAnimation();
            }
          }, 200);
          return;
        }

        // Create new source if it doesn't exist or audio element changed
        if (!sourceRef.current || audioElementChanged) {
          try {
            // Mark as connecting immediately to prevent race conditions
            connectingAudioElements.add(audioElement);
            
            sourceRef.current = audioContext.createMediaElementSource(audioElement);
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContext.destination);
            
            // Share the analyser with other components
            sharedAnalysers.set(audioElement, analyserRef.current);
            
            // Track this connection and remove from connecting set
            connectedAudioElements.set(audioElement, sourceRef.current);
            connectingAudioElements.delete(audioElement);
          } catch (error: any) {
            // Remove from connecting set on error
            connectingAudioElements.delete(audioElement);
            
            // If audio element is already connected, try to use shared analyser
            if (error.message && error.message.includes('already connected')) {
              const fallbackAnalyser = sharedAnalysers.get(audioElement);
              if (fallbackAnalyser) {
                analyserRef.current = fallbackAnalyser;
                dataArrayRef.current = new Uint8Array(fallbackAnalyser.frequencyBinCount);
                setUseFallback(false);
                startVisualization();
                return;
              }
              // No shared analyser available, use fallback animation
              setUseFallback(true);
              startFallbackAnimation();
              return;
            }
            throw error;
          }
        }

        setUseFallback(false);
        startVisualization();
      } catch (error) {
        console.warn("Web Audio API not available, using fallback animation:", error);
        setUseFallback(true);
        startFallbackAnimation();
      }
    };

    setupAudioContext();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Clean up when component unmounts or audio element changes
      if (audioElementRef.current && sourceRef.current) {
        try {
          sourceRef.current.disconnect();
          connectedAudioElements.delete(audioElementRef.current);
          connectingAudioElements.delete(audioElementRef.current);
        } catch (e) {
          // Ignore disconnect errors
        }
        sourceRef.current = null;
      }
    };
  }, [audioElement, isPlaying, variant, barCount]);

  const drawStatic = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (variant === "circle") {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 10;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (variant === "wave") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    } else {
      const barWidth = width / (barCount * 2 - 1);
      const spacing = barWidth;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + spacing);
        const barHeight = height * 0.15;
        const y = (height - barHeight) / 2;
        const radius = barWidth / 2;
        
        drawRoundedRect(ctx, x, y, barWidth, barHeight, radius);
        ctx.fill();
      }
    }
  };

  const startVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current || !dataArrayRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      if (!isPlaying || !analyserRef.current || !dataArrayRef.current) {
        drawStatic();
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      ctx.clearRect(0, 0, width, height);

      if (variant === "circle") {
        drawCircleVisualization(ctx, width, height, dataArrayRef.current);
      } else if (variant === "wave") {
        drawWaveVisualization(ctx, width, height, dataArrayRef.current);
      } else {
        drawBarsVisualization(ctx, width, height, dataArrayRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const drawBarsVisualization = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array
  ) => {
    const barWidth = width / (barCount * 2 - 1);
    const spacing = barWidth;
    const maxBarHeight = height * 0.9;
    const minBarHeight = height * 0.1;

    const step = Math.floor(dataArray.length / barCount);
    
    for (let i = 0; i < barCount; i++) {
      const dataIndex = i * step;
      const value = dataArray[dataIndex] || 0;
      const normalizedValue = value / 255;
      
      // Apply easing for smoother animation
      const easedValue = normalizedValue * normalizedValue;
      const barHeight = minBarHeight + easedValue * (maxBarHeight - minBarHeight);

      const x = i * (barWidth + spacing);
      const y = (height - barHeight) / 2;
      const radius = barWidth / 2;

      // Create gradient
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.5, adjustBrightness(color, 0.8));
      gradient.addColorStop(1, adjustBrightness(color, 0.5));

      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.9;

      // Draw rounded rectangle with glow effect
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, radius);
      ctx.fill();

      // Add glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  const drawCircleVisualization = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    const maxRadius = radius + 30;

    const step = Math.floor(dataArray.length / barCount);
    const angleStep = (Math.PI * 2) / barCount;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    for (let i = 0; i < barCount; i++) {
      const dataIndex = i * step;
      const value = dataArray[dataIndex] || 0;
      const normalizedValue = value / 255;
      const easedValue = normalizedValue * normalizedValue;
      
      const currentRadius = radius + easedValue * (maxRadius - radius);
      const angle = i * angleStep - Math.PI / 2;

      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * currentRadius;
      const y2 = centerY + Math.sin(angle) * currentRadius;

      // Create gradient
      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, adjustBrightness(color, 0.6));

      ctx.strokeStyle = gradient;
      ctx.globalAlpha = 0.8 + easedValue * 0.2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Add glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  };

  const drawWaveVisualization = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array
  ) => {
    const centerY = height / 2;
    const maxAmplitude = height * 0.4;
    const step = width / dataArray.length;

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;

    // Draw top wave
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i] || 0;
      const normalizedValue = value / 255;
      const easedValue = normalizedValue * normalizedValue;
      const amplitude = easedValue * maxAmplitude;
      const x = i * step;
      const y = centerY - amplitude;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw bottom wave
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i] || 0;
      const normalizedValue = value / 255;
      const easedValue = normalizedValue * normalizedValue;
      const amplitude = easedValue * maxAmplitude;
      const x = i * step;
      const y = centerY + amplitude;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Add fill with gradient
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i] || 0;
      const normalizedValue = value / 255;
      const easedValue = normalizedValue * normalizedValue;
      const amplitude = easedValue * maxAmplitude;
      const x = i * step;
      const y = centerY - amplitude;
      ctx.lineTo(x, y);
    }
    for (let i = dataArray.length - 1; i >= 0; i--) {
      const value = dataArray[i] || 0;
      const normalizedValue = value / 255;
      const easedValue = normalizedValue * normalizedValue;
      const amplitude = easedValue * maxAmplitude;
      const x = i * step;
      const y = centerY + amplitude;
      ctx.lineTo(x, y);
    }
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, adjustBrightness(color, 0.3));
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, adjustBrightness(color, 0.3));

    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.3;
    ctx.fill();
  };

  const startFallbackAnimation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    let phase = 0;

    const draw = () => {
      if (!isPlaying) {
        drawStatic();
        return;
      }

      ctx.clearRect(0, 0, width, height);

      phase += 0.15;

      if (variant === "circle") {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 20;
        const maxRadius = radius + 30;
        const angleStep = (Math.PI * 2) / barCount;

        ctx.lineWidth = 3;
        ctx.lineCap = "round";

        for (let i = 0; i < barCount; i++) {
          const offset = (i / barCount) * Math.PI * 2;
          const wave = Math.sin(phase + offset);
          const normalizedWave = (wave + 1) / 2;
          const easedValue = normalizedWave * normalizedWave;
          
          const currentRadius = radius + easedValue * (maxRadius - radius);
          const angle = i * angleStep - Math.PI / 2;

          const x1 = centerX + Math.cos(angle) * radius;
          const y1 = centerY + Math.sin(angle) * radius;
          const x2 = centerX + Math.cos(angle) * currentRadius;
          const y2 = centerY + Math.sin(angle) * currentRadius;

          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, adjustBrightness(color, 0.6));

          ctx.strokeStyle = gradient;
          ctx.globalAlpha = 0.8 + easedValue * 0.2;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } else if (variant === "wave") {
        const centerY = height / 2;
        const maxAmplitude = height * 0.4;
        const step = width / barCount;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.9;

        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let i = 0; i < barCount; i++) {
          const offset = (i / barCount) * Math.PI * 4;
          const wave = Math.sin(phase + offset);
          const normalizedWave = (wave + 1) / 2;
          const easedValue = normalizedWave * normalizedWave;
          const amplitude = easedValue * maxAmplitude;
          const x = i * step;
          const y = centerY - amplitude;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        const barWidth = width / (barCount * 2 - 1);
        const spacing = barWidth;
        const maxBarHeight = height * 0.9;
        const minBarHeight = height * 0.1;

        for (let i = 0; i < barCount; i++) {
          const offset = (i / barCount) * Math.PI * 2;
          const wave = Math.sin(phase + offset);
          const normalizedWave = (wave + 1) / 2;
          const easedValue = normalizedWave * normalizedWave;
          const barHeight = minBarHeight + easedValue * (maxBarHeight - minBarHeight);

          const x = i * (barWidth + spacing);
          const y = (height - barHeight) / 2;
          const radius = barWidth / 2;

          const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, color);
          gradient.addColorStop(0.5, adjustBrightness(color, 0.8));
          gradient.addColorStop(1, adjustBrightness(color, 0.5));

          ctx.fillStyle = gradient;
          ctx.globalAlpha = 0.9;

          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, radius);
          ctx.fill();

          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const adjustBrightness = (color: string, factor: number): string => {
    // Simple brightness adjustment for hex colors
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const newR = Math.min(255, Math.floor(r * factor));
    const newG = Math.min(255, Math.floor(g * factor));
    const newB = Math.min(255, Math.floor(b * factor));

    return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      drawStatic();
    }
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

