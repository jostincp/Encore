'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import MusicPlayer from '../../components/MusicPlayer';

function PlayerContent() {
  const searchParams = useSearchParams();
  const barId = searchParams.get('barId');

  if (!barId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">🎵 Reproductor de Música</h1>
          <p className="text-gray-400">Bar ID requerido</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <MusicPlayer barId={barId} />
      </div>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Cargando reproductor...</div>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}