"use client";

import React, { useEffect, useRef, useState } from "react";

interface AudioWaveformProps {
  isPlaying: boolean;
  audioElement?: HTMLAudioElement | null;
  className?: string;
  barCount?: number;
  color?: string;
}

export default function AudioWaveform({
  isPlaying,
  audioElement,
  className = "",
  barCount = 5,
  color = "#FFDA2A",
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (!audioElement || !isPlaying) {
      // Stop animation when not playing
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      // Draw static bars
      drawStaticBars();
      return;
    }

    // Try to use Web Audio API for real audio visualization
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
          analyserRef.current.fftSize = 256;
          analyserRef.current.smoothingTimeConstant = 0.8;
          dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
        }

        if (!sourceRef.current) {
          sourceRef.current = audioContext.createMediaElementSource(audioElement);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContext.destination);
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
    };
  }, [audioElement, isPlaying]);

  const drawStaticBars = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / (barCount * 2 - 1);
    const spacing = barWidth;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + spacing);
      const barHeight = height * 0.2; // Static small height
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  };

  const startVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current || !dataArrayRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / (barCount * 2 - 1);
    const spacing = barWidth;

    const draw = () => {
      if (!isPlaying || !analyserRef.current || !dataArrayRef.current) {
        drawStaticBars();
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;

      // Use frequency data to create bars
      const step = Math.floor(dataArrayRef.current.length / barCount);
      for (let i = 0; i < barCount; i++) {
        const dataIndex = i * step;
        const value = dataArrayRef.current[dataIndex] || 0;
        const barHeight = (value / 255) * height * 0.8;
        const minHeight = height * 0.1;
        const finalHeight = Math.max(barHeight, minHeight);

        const x = i * (barWidth + spacing);
        const y = (height - finalHeight) / 2;

        // Add rounded corners
        const radius = barWidth / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, y + finalHeight - radius);
        ctx.quadraticCurveTo(x + barWidth, y + finalHeight, x + barWidth - radius, y + finalHeight);
        ctx.lineTo(x + radius, y + finalHeight);
        ctx.quadraticCurveTo(x, y + finalHeight, x, y + finalHeight - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const startFallbackAnimation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / (barCount * 2 - 1);
    const spacing = barWidth;

    let phase = 0;

    const draw = () => {
      if (!isPlaying) {
        drawStaticBars();
        return;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;

      phase += 0.1;

      for (let i = 0; i < barCount; i++) {
        // Create wave-like animation
        const offset = (i / barCount) * Math.PI * 2;
        const wave = Math.sin(phase + offset);
        const normalizedWave = (wave + 1) / 2; // 0 to 1
        const barHeight = height * (0.2 + normalizedWave * 0.6); // 20% to 80% of height

        const x = i * (barWidth + spacing);
        const y = (height - barHeight) / 2;

        // Add rounded corners
        const radius = barWidth / 2;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, y + barHeight - radius);
        ctx.quadraticCurveTo(x + barWidth, y + barHeight, x + barWidth - radius, y + barHeight);
        ctx.lineTo(x + radius, y + barHeight);
        ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  // Initialize canvas size
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

  // Draw static bars initially
  useEffect(() => {
    if (!isPlaying) {
      drawStaticBars();
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

