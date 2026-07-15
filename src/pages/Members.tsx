import { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format, addDays } from 'date-fns'
import {
  useMembers,
  useSubscriptions,
  useAttendance,
  usePayments,
  useSessionPacks,
  useAppSettings,
  addMember,
  updateMember,
  deleteMember,
  addSubscription,
  updateSubscription,
  expireActiveSubscriptions,
  addPayment,
  type SubscriptionWithStatus,
} from '../db/hooks'
import type { Member, SessionPack } from '../db/database'
import { daysRemaining } from '../utils/schedule'
import { openWhatsAppReminder } from '../utils/whatsapp'
import PageBg from '../components/PageBg'

/* ─────────────────── Add Fighter Modal ─────────────────── */

function AddFighterModal({
  open,
  onClose,
  monthlyFee,
  packs,
}: {
  open: boolean
  onClose: () => void
  monthlyFee: number
  packs: SessionPack[]
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [planType, setPlanType] = useState<'monthly' | 'sessions'>('monthly')
  const [selectedPackId, setSelectedPackId] = useState<number | null>(packs[0]?.id ?? null)
  const [amount, setAmount] = useState(monthlyFee)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [busy, setBusy] = useState(false)

  const handlePlanSwitch = (t: 'monthly' | 'sessions') => {
    setPlanType(t)
    if (t === 'monthly') {
      setAmount(monthlyFee)
    } else if (packs.length > 0) {
      setSelectedPackId(packs[0].id!)
      setAmount(packs[0].price)
    }
  }

  const reset = () => {
    setName(''); setPhone(''); setPlanType('monthly'); setAmount(monthlyFee)
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
  }

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.dataset.modalOpen = '1'
    return () => {
      document.body.style.overflow = prev
      delete document.body.dataset.modalOpen
    }
  }, [open])

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !amount || amount <= 0) return
    setBusy(true)
    try {
      const memberId = await addMember({ name: name.trim(), phone: phone.trim(), joinDate: startDate })

      if (planType === 'monthly') {
        const subId = await addSubscription({ memberId, planType: 'monthly', startDate, endDate: format(addDays(new Date(startDate), 30), 'yyyy-MM-dd'), amount })
        await addPayment({ memberId, subscriptionId: subId, amount, date: startDate, notes: 'Monthly subscription' })
      } else {
        const pack = packs.find((p) => p.id === selectedPackId)
        const subId = await addSubscription({ memberId, planType: 'sessions', startDate, totalSessions: pack?.sessionCount ?? 10, usedSessions: 0, amount })
        await addPayment({ memberId, subscriptionId: subId, amount, date: startDate, notes: 'Session pack' })
      }
      reset(); onClose()
    } finally { setBusy(false) }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4 shrink-0 bg-white/20" />
        <h3 className="text-xl font-bold text-white mb-1 shrink-0">Add Fighter</h3>
        <p className="text-gray-400 text-sm mb-4 shrink-0">Enroll a new member</p>

        <div className="modal-body space-y-4">
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fighter name"
              className="w-full glass-input text-white rounded-xl px-4 py-3 text-base outline-none" />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1">WhatsApp Number *</label>
            <input type="tel" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210"
              className="w-full glass-input text-white rounded-xl px-4 py-3 text-base outline-none" />
          </div>
          <div>
            <label className="text-gray-400 text-sm font-medium block mb-2">Plan</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => handlePlanSwitch('monthly')}
                className={`py-3 rounded-xl font-bold text-sm transition-all duration-200 ${planType === 'monthly' ? 'bg-red-600/90 text-white shadow-lg shadow-red-900/30' : 'glass-btn text-gray-300'}`}>Monthly</button>
              <button type="button" onClick={() => handlePlanSwitch('sessions')} disabled={packs.length === 0}
                className={`py-3 rounded-xl font-bold text-sm transition-all duration-200 ${planType === 'sessions' ? 'bg-red-600/90 text-white shadow-lg shadow-red-900/30' : 'glass-btn text-gray-300'} disabled:opacity-30`}>Sessions</button>
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full glass-input text-white rounded-xl px-4 py-3 text-base outline-none" />
          </div>

          {planType === 'sessions' && packs.length > 0 && (
            <div>
              <label className="text-gray-400 text-sm font-medium block mb-1">Session Pack</label>
              <select value={selectedPackId ?? ''} onChange={(e) => { const id = Number(e.target.value); setSelectedPackId(id); const p = packs.find((p) => p.id === id); if (p) setAmount(p.price) }}
                className="w-full glass-input text-white rounded-xl px-4 py-3 text-base outline-none">
                {packs.map((p) => <option key={p.id} value={p.id}>{p.sessionCount} sessions — ₹{p.price.toLocaleString('en-IN')}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-gray-400 text-sm font-medium block mb-1">Payment Amount (₹)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full glass-input text-white rounded-xl px-4 py-3 text-base outline-none" />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={handleSubmit} disabled={!name.trim() || !phone.trim() || !amount || amount <= 0 || busy}
            className="w-full bg-red-600/90 hover:bg-red-600 disabled:opacity-40 text-white font-black text-base py-4 rounded-xl shadow-lg shadow-red-900/25 transition-all duration-200 btn-impact uppercase tracking-wider">
            {busy ? 'Enrolling...' : 'Enroll Fighter'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ─────────────────── Renew Inline Form ─────────────────── */

function RenewForm({ memberId, monthlyFee, packs, onDone }: { memberId: number; monthlyFee: number; packs: SessionPack[]; onDone: () => void }) {
  const [planType, setPlanType] = useState<'monthly' | 'sessions'>('monthly')
  const [selectedPackId, setSelectedPackId] = useState<number | null>(packs[0]?.id ?? null)
  const [amount, setAmount] = useState(monthlyFee)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    if (!amount || amount <= 0) return
    setBusy(true)
    try {
      await expireActiveSubscriptions(memberId, startDate)
      if (planType === 'monthly') {
        const subId = await addSubscription({ memberId, planType: 'monthly', startDate, endDate: format(addDays(new Date(startDate), 30), 'yyyy-MM-dd'), amount })
        await addPayment({ memberId, subscriptionId: subId, amount, date: startDate, notes: 'Monthly renewal' })
      } else {
        const pack = packs.find((p) => p.id === selectedPackId)
        const subId = await addSubscription({ memberId, planType: 'sessions', startDate, totalSessions: pack?.sessionCount ?? 10, usedSessions: 0, amount })
        await addPayment({ memberId, subscriptionId: subId, amount, date: startDate, notes: 'Session pack purchase' })
      }
      onDone()
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-3 glass-card rounded-xl p-4 space-y-3">
      <p className="text-white font-bold text-sm">Renew Plan</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { setPlanType('monthly'); setAmount(monthlyFee) }} className={`py-2.5 rounded-xl font-bold text-sm transition-all ${planType === 'monthly' ? 'bg-red-600 text-white' : 'glass-btn text-gray-400'}`}>Monthly</button>
        <button type="button" onClick={() => { setPlanType('sessions'); if (packs.length > 0) { setSelectedPackId(packs[0].id!); setAmount(packs[0].price) } }} disabled={packs.length === 0} className={`py-2.5 rounded-xl font-bold text-sm transition-all ${planType === 'sessions' ? 'bg-red-600 text-white' : 'glass-btn text-gray-400'} disabled:opacity-30`}>Sessions</button>
      </div>
      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full glass-input text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
      {planType === 'sessions' && packs.length > 0 && (
        <select value={selectedPackId ?? ''} onChange={(e) => { const id = Number(e.target.value); setSelectedPackId(id); const p = packs.find((p) => p.id === id); if (p) setAmount(p.price) }}
          className="w-full glass-input text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors">
          {packs.map((p) => <option key={p.id} value={p.id}>{p.sessionCount} sessions — ₹{p.price.toLocaleString('en-IN')}</option>)}
        </select>
      )}
      <div>
        <label className="text-gray-500 text-xs block mb-1">Amount (₹)</label>
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full glass-input text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handleConfirm} disabled={busy || !amount || amount <= 0} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl btn-impact text-sm">{busy ? 'Processing...' : 'Confirm'}</button>
        <button type="button" onClick={onDone} className="px-4 glass-btn text-gray-400 font-bold py-3 rounded-xl btn-impact text-sm">Cancel</button>
      </div>
    </div>
  )
}

/* ─────────────────── Member Card ─────────────────── */

function MemberCard({
  member, subs, attendanceCount, payments, monthlyFee, upiId, coachPhone, packs,
}: {
  member: Member; subs: SubscriptionWithStatus[]; attendanceCount: number
  payments: { date: string; amount: number; notes?: string }[]
  monthlyFee: number; upiId: string; coachPhone: string; packs: SessionPack[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [renewing, setRenewing] = useState(false)

  const [editName, setEditName] = useState(member.name)
  const [editPhone, setEditPhone] = useState(member.phone)
  const [editJoinDate, setEditJoinDate] = useState(member.joinDate)
  const [editNotes, setEditNotes] = useState(member.notes ?? '')

  // Subscription editing
  const latest = subs[0]
  const [editPlanType, setEditPlanType] = useState(latest?.planType ?? 'monthly')
  const [editStartDate, setEditStartDate] = useState(latest?.startDate ?? '')
  const [editTotalSessions, setEditTotalSessions] = useState(latest?.totalSessions ?? 10)
  const [editUsedSessions, setEditUsedSessions] = useState(latest?.usedSessions ?? 0)

  const activeSub = subs.find((s) => s.status === 'active')
  const isActive = !!activeSub

  const planLabel = useMemo(() => {
    if (!latest) return 'No plan'
    if (latest.planType === 'monthly') {
      const rem = latest.endDate ? daysRemaining(latest.endDate) : 0
      const end = latest.endDate ? format(new Date(latest.endDate), 'd MMM yyyy') : '—'
      return `Monthly · ₹${latest.amount.toLocaleString('en-IN')} · ${end} (${rem >= 0 ? `${rem}d left` : 'expired'})`
    }
    return `Sessions · ${latest.usedSessions ?? 0}/${latest.totalSessions ?? 0} used · ₹${latest.amount.toLocaleString('en-IN')}`
  }, [latest])

  const handleSaveEdit = async () => {
    await updateMember(member.id!, { name: editName.trim(), phone: editPhone.trim(), joinDate: editJoinDate, notes: editNotes.trim() || undefined })

    if (latest?.id) {
      if (editPlanType !== latest.planType) {
        if (editPlanType === 'monthly') {
          await updateSubscription(latest.id, { planType: 'monthly', startDate: editStartDate, endDate: format(addDays(new Date(editStartDate), 30), 'yyyy-MM-dd'), totalSessions: undefined, usedSessions: undefined })
        } else {
          await updateSubscription(latest.id, { planType: 'sessions', startDate: editStartDate, endDate: undefined, totalSessions: editTotalSessions, usedSessions: editUsedSessions })
        }
      } else if (editPlanType === 'monthly' && editStartDate !== latest.startDate) {
        await updateSubscription(latest.id, { startDate: editStartDate, endDate: format(addDays(new Date(editStartDate), 30), 'yyyy-MM-dd') })
      } else if (editPlanType === 'sessions') {
        await updateSubscription(latest.id, { startDate: editStartDate, totalSessions: editTotalSessions, usedSessions: editUsedSessions })
      }
    }
    setEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm(`Delete ${member.name}? This removes all their data and cannot be undone.`)) {
      deleteMember(member.id!)
    }
  }

  const startEditing = () => {
    setEditName(member.name); setEditPhone(member.phone); setEditJoinDate(member.joinDate); setEditNotes(member.notes ?? '')
    if (latest) {
      setEditPlanType(latest.planType); setEditStartDate(latest.startDate)
      setEditTotalSessions(latest.totalSessions ?? 10); setEditUsedSessions(latest.usedSessions ?? 0)
    }
    setEditing(true)
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 text-left">
        <div className="min-w-0 flex-1">
          <span className="text-white font-bold truncate block">{member.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isActive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
            {isActive ? 'Active' : 'Expired'}
          </span>
          <svg className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
          {!editing ? (
            <>
              <div className="space-y-2 text-sm">
                <p className="text-gray-400">📱 <span className="text-white">{member.phone}</span></p>
                <p className="text-gray-400">📋 <span className="text-gray-300">{planLabel}</span></p>
                <p className="text-gray-400">🥊 Attended <span className="text-white font-semibold">{attendanceCount}</span> classes</p>
                <p className="text-gray-400">📅 Joined <span className="text-gray-300">{member.joinDate ? format(new Date(member.joinDate), 'd MMM yyyy') : '—'}</span></p>
                {member.notes && <p className="text-gray-500 text-xs italic">Note: {member.notes}</p>}
              </div>

              {payments.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">Payments</p>
                  <div className="space-y-1">
                    {payments.slice(0, 5).map((p, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-400">{format(new Date(p.date), 'd MMM yyyy')}</span>
                        <span className="text-white font-medium">₹{p.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {renewing && <RenewForm memberId={member.id!} monthlyFee={monthlyFee} packs={packs} onDone={() => setRenewing(false)} />}

              {!renewing && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="button" onClick={() => setRenewing(true)} className="flex-1 min-w-[90px] bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl btn-impact text-sm">Renew</button>
                  {!isActive && (
                    <button type="button" onClick={() => openWhatsAppReminder(member.phone, member.name, upiId, coachPhone, monthlyFee, latest?.endDate)}
                      className="flex-1 min-w-[90px] bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl btn-impact text-sm">WhatsApp</button>
                  )}
                  <button type="button" onClick={startEditing} className="glass-btn text-gray-300 font-bold py-3 px-4 rounded-xl btn-impact text-sm">Edit</button>
                  <button type="button" onClick={handleDelete} className="glass-btn border-red-900/30 text-red-400 font-bold py-3 px-4 rounded-xl btn-impact text-sm">Delete</button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider">Edit Fighter</p>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name"
                className="w-full glass-input text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
              <input type="tel" inputMode="numeric" maxLength={10} value={editPhone} onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Phone"
                className="w-full glass-input text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors" />

              <div>
                <label className="text-gray-500 text-xs block mb-1">Enrollment Date</label>
                <input type="date" value={editJoinDate} onChange={(e) => setEditJoinDate(e.target.value)}
                  className="w-full glass-input text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
              </div>

              {latest && (
                <>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Plan Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setEditPlanType('monthly')} className={`py-2.5 rounded-xl font-bold text-xs transition-all ${editPlanType === 'monthly' ? 'bg-red-600 text-white' : 'glass-btn text-gray-400'}`}>Monthly</button>
                      <button type="button" onClick={() => setEditPlanType('sessions')} className={`py-2.5 rounded-xl font-bold text-xs transition-all ${editPlanType === 'sessions' ? 'bg-red-600 text-white' : 'glass-btn text-gray-400'}`}>Sessions</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Plan Start Date</label>
                    <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)}
                      className="w-full glass-input text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors" />
                  </div>
                  {editPlanType === 'sessions' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-gray-500 text-xs block mb-1">Total Sessions</label>
                        <input type="number" value={editTotalSessions} onChange={(e) => setEditTotalSessions(Number(e.target.value))}
                          className="w-full glass-input text-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors" />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs block mb-1">Used Sessions</label>
                        <input type="number" value={editUsedSessions} onChange={(e) => setEditUsedSessions(Number(e.target.value))}
                          className="w-full glass-input text-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors" />
                      </div>
                    </div>
                  )}
                </>
              )}

              <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes (optional)"
                className="w-full glass-input text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors" />

              <div className="flex gap-2">
                <button type="button" onClick={handleSaveEdit} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl btn-impact text-sm">Save</button>
                <button type="button" onClick={() => setEditing(false)} className="px-4 glass-btn text-gray-400 font-bold py-3 rounded-xl btn-impact text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────── Members Page ─────────────────── */

export default function Members() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const members = useMembers() ?? []
  const allSubs = useSubscriptions() ?? []
  const allAttendance = useAttendance() ?? []
  const allPayments = usePayments() ?? []
  const packs = useSessionPacks() ?? []
  const [settings] = useAppSettings()

  const filtered = useMemo(() => {
    if (!search.trim()) return members
    const q = search.toLowerCase()
    return members.filter((m) => m.name.toLowerCase().includes(q))
  }, [members, search])

  const getMemberSubs = useCallback((id: number) => allSubs.filter((s) => s.memberId === id).sort((a, b) => b.startDate.localeCompare(a.startDate)), [allSubs])
  const getAttCount = useCallback((id: number) => allAttendance.filter((a) => a.memberId === id).length, [allAttendance])
  const getMemberPayments = useCallback((id: number) => allPayments.filter((p) => p.memberId === id).sort((a, b) => b.date.localeCompare(a.date)), [allPayments])

  return (
    <PageBg src="./coach-kick.png" opacity={0.50}>
      <div className="text-white page-pad-fab px-4 safe-top">
      <h1 className="text-2xl font-black text-white mb-4">Fighters</h1>
      <div className="relative mb-4">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fighters..."
          className="w-full glass-card text-white rounded-2xl pl-12 pr-4 py-3.5 text-base outline-none border-0"
        />
      </div>

      <p className="text-gray-500 text-sm mb-3">{filtered.length} fighter{filtered.length !== 1 ? 's' : ''}{search && ` matching "${search}"`}</p>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((m) => (
            <MemberCard key={m.id} member={m} subs={getMemberSubs(m.id!)} attendanceCount={getAttCount(m.id!)} payments={getMemberPayments(m.id!)}
              monthlyFee={settings.monthlyFee} upiId={settings.upiId} coachPhone={settings.coachPhone} packs={packs} />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center mt-8">
          <p className="text-4xl mb-3">🥊</p>
          {members.length === 0 ? (
            <><p className="text-gray-300 font-semibold">No fighters yet</p><p className="text-gray-500 text-sm mt-1">Tap below to enroll your first fighter.</p></>
          ) : (
            <><p className="text-gray-300 font-semibold">No matches found</p><p className="text-gray-500 text-sm mt-1">Try a different search.</p></>
          )}
        </div>
      )}

      {!showAdd && (
        <div className="fixed left-0 right-0 px-4 z-30 fab-above-nav pointer-events-none">
          <button type="button" onClick={() => setShowAdd(true)} className="pointer-events-auto w-full max-w-lg mx-auto block bg-red-600 hover:bg-red-700 text-white font-black text-base py-4 rounded-xl shadow-lg shadow-red-900/40 transition-all duration-200 btn-impact uppercase tracking-wider">
            Add Fighter +
          </button>
        </div>
      )}

      <AddFighterModal open={showAdd} onClose={() => setShowAdd(false)} monthlyFee={settings.monthlyFee} packs={packs} />
      </div>
    </PageBg>
  )
}
