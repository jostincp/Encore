'use client';

import dynamic from 'next/dynamic';

// Import the YouTube player page component dynamically to avoid SSR issues
const YouTubePlayerPage = dynamic(
  () => import('../../../pages/YouTubePlayerPage'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-white">Loading YouTube Player...</p>
        </div>
      </div>
    )
  }
);

export default function YouTubePlayer() {
  return <YouTubePlayerPage />;
}