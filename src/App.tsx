import { useState, useEffect, useRef, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import BottomNav from './components/BottomNav'
import BrandTitle from './components/BrandTitle'
import Home from './pages/Home'
import Attendance from './pages/Attendance'
import Members from './pages/Members'
import Settings from './pages/Settings'
import { runWeeklyAutoBackup } from './db/database'

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const enter = requestAnimationFrame(() => setReady(true))
    const leave = setTimeout(() => setLeaving(true), 3000)
    const done = setTimeout(() => onDoneRef.current(), 3800)
    return () => {
      cancelAnimationFrame(enter)
      clearTimeout(leave)
      clearTimeout(done)
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{
        opacity: leaving ? 0 : 1,
        transition: 'opacity 700ms ease-out',
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <img src="./gym-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/65" />

      <div className="absolute top-[18%] left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />
      <div className="absolute top-[32%] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent" />
      <div className="absolute bottom-[32%] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/25 to-transparent" />
      <div className="absolute bottom-[18%] left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />

      <div
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? 'scale(1) translateY(0)' : 'scale(1.08) translateY(12px)',
          transition: 'opacity 800ms ease-out, transform 800ms ease-out',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div className="relative">
          <img
            src="./coach-hero.png"
            alt="Coach Somnath"
            className="w-52 h-52 object-cover object-top rounded-2xl border-2 border-amber-500/40 shadow-2xl shadow-amber-900/40"
          />
          <div className="absolute inset-0 rounded-2xl shadow-[inset_0_-40px_30px_-10px_rgba(0,0,0,0.7)]" />
        </div>

        <BrandTitle align="center" size="lg" showLocation className="mt-6" />
      </div>

      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-36 h-1.5 bg-gray-800/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-red-600 rounded-full"
          style={{
            width: ready ? '100%' : '0%',
            transition: 'width 2800ms linear',
          }}
        />
      </div>
    </div>
  )
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const dismissSplash = useCallback(() => setShowSplash(false), [])

  useEffect(() => {
    const t = setTimeout(() => {
      runWeeklyAutoBackup()
    }, 2500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-gray-100">
      {showSplash && <SplashScreen onDone={dismissSplash} />}
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/members" element={<Members />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      <BottomNav />
    </div>
  )
}
