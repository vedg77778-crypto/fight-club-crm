import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useMembers,
  useSubscriptions,
  useAppSettings,
  markPaidRenewMonthly,
  type SubscriptionWithStatus,
} from '../db/hooks'
import type { Member } from '../db/database'
import { getTodayClassType, daysRemaining } from '../utils/schedule'
import { openWhatsAppReminder } from '../utils/whatsapp'
import PageBg from '../components/PageBg'
import BrandTitle from '../components/BrandTitle'

function RedDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-red-900/40" />
      <div className="w-2 h-2 rotate-45 bg-red-600/70" />
      <div className="flex-1 h-px bg-red-900/40" />
    </div>
  )
}

interface AlertItem {
  member: Member
  label: string
  kind: 'expiring' | 'expired'
  endDate?: string
}

function buildAlerts(members: Member[], subs: SubscriptionWithStatus[]): AlertItem[] {
  const alerts: AlertItem[] = []
  for (const m of members) {
    const memberSubs = subs
      .filter((s) => s.memberId === m.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
    const active = memberSubs.find((s) => s.status === 'active')

    if (!active) {
      const last = memberSubs[0]
      if (last?.planType === 'monthly' && last.endDate) {
        const d = -daysRemaining(last.endDate)
        alerts.push({
          member: m,
          label: d === 0 ? 'Expired today' : `Expired ${d}d ago`,
          kind: 'expired',
          endDate: last.endDate,
        })
      } else if (last?.planType === 'sessions') {
        alerts.push({ member: m, label: '0 sessions left', kind: 'expired' })
      } else if (memberSubs.length > 0) {
        alerts.push({ member: m, label: 'No active plan', kind: 'expired', endDate: last?.endDate })
      }
      continue
    }

    if (active.planType === 'monthly' && active.endDate) {
      const rem = daysRemaining(active.endDate)
      if (rem >= 0 && rem <= 7) {
        alerts.push({
          member: m,
          label: rem === 0 ? 'Expires today' : `Expires in ${rem}d`,
          kind: 'expiring',
          endDate: active.endDate,
        })
      }
    }

    if (active.planType === 'sessions') {
      const rem = (active.totalSessions ?? 0) - (active.usedSessions ?? 0)
      if (rem <= 2) {
        alerts.push({ member: m, label: rem <= 0 ? '0 sessions left' : `${rem} session${rem !== 1 ? 's' : ''} left`, kind: rem <= 0 ? 'expired' : 'expiring' })
      }
    }
  }
  return alerts
}

export default function Home() {
  const navigate = useNavigate()
  const members = useMembers() ?? []
  const allSubs = useSubscriptions() ?? []
  const [settings] = useAppSettings()
  const [payingId, setPayingId] = useState<number | null>(null)

  const classToday = getTodayClassType(settings.classDays)
  const isClassToday = classToday !== null
  const alerts = useMemo(() => buildAlerts(members, allSubs), [members, allSubs])

  const stats = useMemo(() => {
    let active = 0
    for (const m of members) {
      if (allSubs.some((s) => s.memberId === m.id && s.status === 'active')) active++
    }
    return { total: members.length, active, expired: members.length - active }
  }, [members, allSubs])

  const handleMarkPaid = async (a: AlertItem) => {
    if (!a.member.id || payingId !== null) return
    setPayingId(a.member.id)
    try {
      await markPaidRenewMonthly(a.member.id, settings.monthlyFee, a.endDate)
    } finally {
      setPayingId(null)
    }
  }

  return (
    <PageBg src="./coach-hero.png" opacity={0.50}>
      <div className="page-pad px-4 safe-top">
        <BrandTitle align="left" size="lg" className="mb-6" />

        {/* Today's Class Card */}
        <div className="glass-card rounded-2xl p-5 mb-4">
          {isClassToday ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                </span>
                <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                  Today's Class
                </span>
              </div>
              <p className="text-3xl font-black text-white capitalize mt-1">{classToday}</p>
              <button
                type="button"
                onClick={() => navigate('/attendance')}
                className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold text-base py-3 px-6 rounded-xl shadow-lg shadow-red-900/30 transition-all duration-200 btn-impact"
              >
                Mark Attendance →
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-5xl mb-3">😤</p>
              <p className="text-2xl font-black text-gray-300">REST DAY</p>
              <p className="text-gray-500 mt-2 text-sm">
                No class today. Recovery is part of the fight, champ.
              </p>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-white">{stats.total}</p>
            <p className="text-gray-400 text-xs mt-1">Fighters</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-green-400">{stats.active}</p>
            <p className="text-gray-400 text-xs mt-1">Active</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-red-400">{stats.expired}</p>
            <p className="text-gray-400 text-xs mt-1">Expired</p>
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <>
            <RedDivider />
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-red-500">⚠</span> Attention Needed
            </h2>
            <div className="space-y-3">
              {alerts.map((a) => (
                <div key={a.member.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{a.member.name}</p>
                    <p className={`text-sm mt-0.5 ${a.kind === 'expired' ? 'text-red-400' : 'text-amber-400'}`}>{a.label}</p>
                  </div>
                  <div className="shrink-0 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => openWhatsAppReminder(a.member.phone, a.member.name, settings.upiId, settings.coachPhone, settings.monthlyFee, a.endDate)}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-4 rounded-xl transition-all duration-200 btn-impact"
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      disabled={payingId === a.member.id}
                      onClick={() => handleMarkPaid(a)}
                      className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-black text-sm font-bold py-2 px-4 rounded-xl transition-all duration-200 btn-impact"
                    >
                      {payingId === a.member.id ? 'Saving…' : 'Mark Paid'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {alerts.length === 0 && members.length > 0 && (
          <>
            <RedDivider />
            <div className="glass-card rounded-xl p-5 text-center">
              <p className="text-green-400 font-semibold">All fighters are active! 💪</p>
              <p className="text-gray-500 text-sm mt-1">No renewals needed right now.</p>
            </div>
          </>
        )}

        {members.length === 0 && (
          <>
            <RedDivider />
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-4xl mb-3">🥊</p>
              <p className="text-gray-300 font-semibold">No fighters enrolled yet</p>
              <p className="text-gray-500 text-sm mt-1">Head to the Fighters tab to add your first fighter.</p>
              <button type="button" onClick={() => navigate('/members')} className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-red-900/30 transition-all duration-200 btn-impact">
                Add Fighter +
              </button>
            </div>
          </>
        )}
      </div>
    </PageBg>
  )
}
