"use client";

import { useSearchParams } from "next/navigation";
import MVCustomize from "@/components/music/mv-customize";
import { useEffect, useState } from "react";

export default function MVCustomizePage() {
  const searchParams = useSearchParams();
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(30);
  const [musicTitle, setMusicTitle] = useState<string>('');
  const [musicId, setMusicId] = useState<string>('');

  useEffect(() => {
    if (searchParams) {
      setAudioUrl(searchParams.get('audioUrl') || '');
      setStartTime(parseFloat(searchParams.get('startTime') || '0'));
      setEndTime(parseFloat(searchParams.get('endTime') || '30'));
      setMusicTitle(searchParams.get('musicTitle') || '');
      setMusicId(searchParams.get('musicId') || '');
    }
  }, [searchParams]);

  if (!audioUrl) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <MVCustomize
      audioUrl={audioUrl}
      startTime={startTime}
      endTime={endTime}
      musicTitle={musicTitle}
      musicId={musicId}
    />
  );
}

