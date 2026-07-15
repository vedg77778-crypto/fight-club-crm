import { useState, useMemo, useCallback } from 'react'
import { format, addDays, subDays } from 'date-fns'
import {
  useMembers,
  useSubscriptions,
  useAttendanceByDate,
  useAppSettings,
  addAttendance,
  removeAttendance,
} from '../db/hooks'
import {
  getTodayClassType,
  getClassTypeForDate,
} from '../utils/schedule'
import PageBg from '../components/PageBg'

function AttendanceStamp({
  present,
  onToggle,
}: {
  present: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={present}
      aria-label={present ? 'Mark absent' : 'Mark present'}
      className={`attn-check ${present ? 'attn-check--on' : 'attn-check--off'}`}
    >
      <svg className="attn-check__tick" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 12.5l4.5 4.5L19 7"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

/** Walk to the nearest scheduled class day on/before `from` (up to 2 weeks back). */
function nearestClassDate(from: Date, classDays: Array<{ day: string; type: 'boxing' | 'kickboxing' }>): Date {
  let d = from
  for (let i = 0; i < 14; i++) {
    if (getClassTypeForDate(d, classDays)) return d
    d = subDays(d, 1)
  }
  return from
}

function RedDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-red-900/40" />
      <div className="w-2 h-2 rotate-45 bg-red-600/70" />
      <div className="flex-1 h-px bg-red-900/40" />
    </div>
  )
}

export default function Attendance() {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const [settings] = useAppSettings()
  const classToday = getTodayClassType(settings.classDays)
  const isClassToday = classToday !== null

  const [pastDate, setPastDate] = useState(() => nearestClassDate(today, settings.classDays))
  const [viewPast, setViewPast] = useState(false)

  const members = useMembers() ?? []
  const allSubs = useSubscriptions() ?? []
  const todayAttendance = useAttendanceByDate(todayStr) ?? []

  const pastDateStr = format(pastDate, 'yyyy-MM-dd')
  const pastAttendance = useAttendanceByDate(pastDateStr) ?? []
  const pastClassType = getClassTypeForDate(pastDate, settings.classDays)

  const eligibleMembers = useMemo(() => {
    if (!classToday) return []
    return members.filter((m) =>
      allSubs.some((s) => s.memberId === m.id && s.status === 'active'),
    )
  }, [members, allSubs, classToday])

  const presentIds = useMemo(
    () => new Set(todayAttendance.map((a) => a.memberId)),
    [todayAttendance],
  )

  const handleToggle = useCallback(
    async (memberId: number) => {
      if (!classToday) return
      if (presentIds.has(memberId)) {
        await removeAttendance(memberId, todayStr)
      } else {
        await addAttendance(memberId, todayStr, classToday)
      }
    },
    [presentIds, todayStr, classToday],
  )

  const sessionsLeft = useCallback(
    (memberId: number): number | null => {
      const sub = allSubs.find(
        (s) => s.memberId === memberId && s.status === 'active' && s.planType === 'sessions',
      )
      if (!sub) return null
      return (sub.totalSessions ?? 0) - (sub.usedSessions ?? 0)
    },
    [allSubs],
  )

  const pastPresentIds = useMemo(
    () => new Set(pastAttendance.map((a) => a.memberId)),
    [pastAttendance],
  )

  const pastEligible = useMemo(() => {
    if (!pastClassType) return []
    return members.filter(
      (m) =>
        m.joinDate <= pastDateStr &&
        allSubs.some((s) => s.memberId === m.id && s.status === 'active'),
    )
  }, [members, allSubs, pastClassType, pastDateStr])

  const handlePastToggle = useCallback(
    async (memberId: number) => {
      if (!pastClassType) return
      if (pastPresentIds.has(memberId)) {
        await removeAttendance(memberId, pastDateStr)
      } else {
        await addAttendance(memberId, pastDateStr, pastClassType)
      }
    },
    [pastPresentIds, pastDateStr, pastClassType],
  )

  const jumpPastPrev = () => {
    let d = subDays(pastDate, 1)
    for (let i = 0; i < 21; i++) {
      if (getClassTypeForDate(d, settings.classDays)) {
        setPastDate(d)
        return
      }
      d = subDays(d, 1)
    }
  }

  const jumpPastNext = () => {
    let d = addDays(pastDate, 1)
    for (let i = 0; i < 21; i++) {
      if (format(d, 'yyyy-MM-dd') > todayStr) return
      if (getClassTypeForDate(d, settings.classDays)) {
        setPastDate(d)
        return
      }
      d = addDays(d, 1)
    }
  }

  const canGoPastNext = (() => {
    let d = addDays(pastDate, 1)
    for (let i = 0; i < 21; i++) {
      if (format(d, 'yyyy-MM-dd') > todayStr) return false
      if (getClassTypeForDate(d, settings.classDays)) return true
      d = addDays(d, 1)
    }
    return false
  })()

  return (
    <PageBg src="./coach-skip.png" opacity={0.50}>
      <div className="page-pad px-4 safe-top">
        {/* Header - left aligned */}
        <div className="text-left mb-6">
          <p className="text-gray-400 text-sm font-medium">{format(today, 'EEEE, d MMMM yyyy')}</p>
          {isClassToday ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
              </span>
              <span className="text-white font-black text-3xl capitalize">{classToday} Day</span>
            </div>
          ) : (
            <p className="text-white font-black text-3xl mt-1">Rest Day</p>
          )}
        </div>

        {isClassToday ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Mark Attendance</h2>
              <div className="glass-card rounded-xl px-3 py-1.5">
                <span className="text-green-400 font-bold">{presentIds.size}</span>
                <span className="text-gray-500">/{eligibleMembers.length}</span>
                <span className="text-gray-500 text-sm ml-1">present</span>
              </div>
            </div>

            {eligibleMembers.length > 0 ? (
              <div className="space-y-2">
                {eligibleMembers.map((m) => {
                  const present = presentIds.has(m.id!)
                  const rem = sessionsLeft(m.id!)
                  return (
                    <div
                      key={m.id}
                      className={`glass-card rounded-xl p-4 flex items-center justify-between gap-3 transition-all duration-200 ${present ? 'attn-row--in' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">
                          {m.name}
                          {rem !== null && (
                            <span className="text-amber-400 text-sm font-normal ml-2">({rem} left)</span>
                          )}
                        </p>
                        <p className={`text-xs font-bold tracking-[0.14em] uppercase mt-0.5 ${present ? 'text-red-400' : 'text-gray-500'}`}>
                          {present ? 'Present' : 'Absent'}
                        </p>
                      </div>
                      <AttendanceStamp present={present} onToggle={() => handleToggle(m.id!)} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="glass-card rounded-xl p-8 text-center">
                <p className="text-4xl mb-3">🥊</p>
                <p className="text-gray-300 font-semibold">No active fighters</p>
                <p className="text-gray-500 text-sm mt-1">Add fighters from the Fighters tab first.</p>
              </div>
            )}

            <RedDivider />

            <button type="button" onClick={() => setViewPast(!viewPast)} className="w-full text-gray-400 text-sm font-medium py-3 flex items-center justify-center gap-2">
              {viewPast ? 'Hide' : 'View'} Past Attendance
              <svg className={`w-4 h-4 transition-transform duration-200 ${viewPast ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <div className="glass-card rounded-2xl p-8 text-center mb-6">
              <p className="text-6xl mb-4">😤</p>
              <p className="text-2xl font-black text-gray-300 mb-2">Rest Day</p>
              <p className="text-gray-500 text-sm">No class today. Recovery is part of the fight, champ.</p>
            </div>
            <button type="button" onClick={() => setViewPast(!viewPast)} className="w-full glass-card text-gray-300 font-semibold py-3 px-6 rounded-xl btn-impact flex items-center justify-center gap-2">
              View Past Attendance
              <svg className={`w-4 h-4 transition-transform duration-200 ${viewPast ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </>
        )}

        {viewPast && (
          <div className="mt-4">
            <div className="flex items-center justify-between glass-card rounded-2xl p-3 mb-4">
              <button
                type="button"
                onClick={jumpPastPrev}
                className="w-12 h-12 flex items-center justify-center rounded-xl glass-btn text-white text-xl btn-impact"
                aria-label="Previous class day"
              >
                ←
              </button>
              <div className="text-center px-2">
                <p className="text-white font-bold text-2xl leading-tight">{format(pastDate, 'd MMM yyyy')}</p>
                <p className="text-gray-300 text-sm mt-0.5">{format(pastDate, 'EEEE')}{pastDateStr === todayStr ? ' · Today' : ''}</p>
                {pastClassType && (
                  <span className="inline-block mt-2 px-3 py-1 rounded-full bg-red-600/25 border border-red-500/40 text-red-300 text-sm font-bold capitalize tracking-wide">
                    {pastClassType}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={jumpPastNext}
                disabled={!canGoPastNext}
                className="w-12 h-12 flex items-center justify-center rounded-xl glass-btn text-white text-xl btn-impact disabled:opacity-30"
                aria-label="Next class day"
              >
                →
              </button>
            </div>

            {pastEligible.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-400 text-sm font-medium">Tap to mark attendance</p>
                  <div className="glass-card rounded-xl px-3 py-1.5">
                    <span className="text-green-400 font-bold">{pastPresentIds.size}</span>
                    <span className="text-gray-500">/{pastEligible.length}</span>
                    <span className="text-gray-500 text-sm ml-1">present</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {pastEligible.map((m) => {
                    const present = pastPresentIds.has(m.id!)
                    const rem = sessionsLeft(m.id!)
                    return (
                      <div
                        key={m.id}
                        className={`glass-card rounded-xl p-4 flex items-center justify-between gap-3 transition-all duration-200 ${present ? 'attn-row--in' : ''}`}
                      >
                        <div className="min-w-0">
                          <p className="text-white font-semibold truncate">
                            {m.name}
                            {rem !== null && (
                              <span className="text-amber-400 text-sm font-normal ml-2">({rem} left)</span>
                            )}
                          </p>
                          <p className={`text-xs font-bold tracking-[0.14em] uppercase mt-0.5 ${present ? 'text-red-400' : 'text-gray-500'}`}>
                            {present ? 'Present' : 'Absent'}
                          </p>
                        </div>
                        <AttendanceStamp present={present} onToggle={() => handlePastToggle(m.id!)} />
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="glass-card rounded-xl p-6 text-center">
                <p className="text-gray-500 text-sm">No active fighters for this date.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageBg>
  )
}
