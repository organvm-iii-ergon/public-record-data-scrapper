import { Play, Rocket } from '@phosphor-icons/react'

export function QuickAccessBanner() {
  return (
    <div className="mica-effect border-b border-primary/10 py-3">
      <div className="container mx-auto px-3 sm:px-4 md:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <span className="text-sm font-medium text-white/90">🎯 Quick Access:</span>
          <a
            href="/public/videos/EXECUTIVE_VIDEO_SCRIPT.mp4"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-sm font-medium transition-all hover:scale-105 shadow-lg"
            download
          >
            <Play size={16} weight="fill" />
            <span>Watch 5-Min Investor Pitch</span>
          </a>
          <a
            href="/access.html"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white text-sm font-medium transition-all hover:scale-105 shadow-lg"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Rocket size={16} weight="fill" />
            <span>Access Page</span>
          </a>
        </div>
      </div>
    </div>
  )
}
