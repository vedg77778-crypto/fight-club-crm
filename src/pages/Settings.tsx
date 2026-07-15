import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  useAppSettings,
  useSessionPacks,
  addSessionPack,
  updateSessionPack,
  deleteSessionPack,
  importAllData,
} from '../db/hooks'
import type { SessionPack } from '../db/database'
import { downloadBackup, readBackupFile } from '../utils/backup'
import { downloadReport } from '../utils/report'
import { getWeeklyBackupDate, getWeeklyBackupJSON } from '../db/database'
import PageBg from '../components/PageBg'
import BrandTitle from '../components/BrandTitle'

function RedDivider() {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-red-900/50" />
      <div className="w-2 h-2 rotate-45 bg-red-600" />
      <div className="flex-1 h-px bg-red-900/50" />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
      {children}
    </h2>
  )
}

/* ───── Session Pack Item ───── */

function PackItem({
  pack,
  onUpdate,
  onDelete,
}: {
  pack: SessionPack
  onUpdate: (count: number, price: number) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [count, setCount] = useState(pack.sessionCount)
  const [price, setPrice] = useState(pack.price)

  if (editing) {
    return (
      <div className="glass-card rounded-xl p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-gray-500 text-xs block mb-1">Sessions</label>
            <input
              type="number"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full glass-input text-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Price (₹)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full glass-input text-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { onUpdate(count, price); setEditing(false) }}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm btn-impact"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => { setCount(pack.sessionCount); setPrice(pack.price); setEditing(false) }}
            className="px-4 glass-btn text-gray-400 font-bold py-2.5 rounded-xl text-sm btn-impact"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-4 flex items-center justify-between">
      <span className="text-white font-medium">
        {pack.sessionCount} sessions —{' '}
        <span className="text-amber-400">₹{pack.price.toLocaleString('en-IN')}</span>
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-gray-400 hover:text-white px-3 py-2 rounded-lg glass-btn text-sm font-medium btn-impact"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 px-3 py-2 rounded-lg glass-btn text-sm font-medium btn-impact"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

/* ───── Class Day Item ───── */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function ClassDayItem({
  day,
  type,
  onUpdate,
  onDelete,
}: {
  day: string
  type: string
  onUpdate: (type: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [localType, setLocalType] = useState(type)

  if (editing) {
    return (
      <div className="glass-card rounded-xl p-3 space-y-2">
        <p className="text-white font-medium text-sm capitalize">{day}</p>
        <div className="grid grid-cols-2 gap-2">
          {['boxing', 'kickboxing'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLocalType(t)}
              className={`py-2.5 rounded-xl font-bold text-sm capitalize transition-all duration-200 ${
                localType === t
                  ? 'bg-red-600 text-white'
                  : 'glass-btn text-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { onUpdate(localType); setEditing(false) }}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm btn-impact"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => { setLocalType(type); setEditing(false) }}
            className="px-4 glass-btn text-gray-400 font-bold py-2.5 rounded-xl text-sm btn-impact"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-4 flex items-center justify-between">
      <span className="text-white font-medium capitalize">
        {day} — <span className="text-red-400">{type}</span>
      </span>
      <div className="flex gap-2">
        <button type="button" onClick={() => setEditing(true)} className="text-gray-400 hover:text-white px-3 py-2 rounded-lg glass-btn text-sm font-medium btn-impact">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="text-red-400 hover:text-red-300 px-3 py-2 rounded-lg glass-btn text-sm font-medium btn-impact">
          Delete
        </button>
      </div>
    </div>
  )
}

/* ───── Settings Page ───── */

export default function Settings() {
  const [settings, saveSettings] = useAppSettings()
  const packs = useSessionPacks() ?? []

  const [upiId, setUpiId] = useState('')
  const [coachPhone, setCoachPhone] = useState('')
  const [monthlyFee, setMonthlyFee] = useState(4500)
  const [upiSaved, setUpiSaved] = useState(false)
  const [phoneSaved, setPhoneSaved] = useState(false)
  const [feeSaved, setFeeSaved] = useState(false)

  const [newCount, setNewCount] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [showAddPack, setShowAddPack] = useState(false)

  const [showAddDay, setShowAddDay] = useState(false)
  const [newDay, setNewDay] = useState('monday')
  const [newDayType, setNewDayType] = useState('boxing')

  const [backupMsg, setBackupMsg] = useState('')
  const [reportMsg, setReportMsg] = useState('')
  const autoBackupDate = getWeeklyBackupDate()

  useEffect(() => {
    setUpiId(settings.upiId)
    setCoachPhone(settings.coachPhone)
    setMonthlyFee(settings.monthlyFee)
  }, [settings.upiId, settings.coachPhone, settings.monthlyFee])

  const flash = (setter: (v: boolean) => void) => {
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  const handleSaveUpi = () => {
    saveSettings({ ...settings, upiId })
    flash(setUpiSaved)
  }

  const handleSavePhone = () => {
    saveSettings({ ...settings, coachPhone })
    flash(setPhoneSaved)
  }

  const handleSaveFee = () => {
    saveSettings({ ...settings, monthlyFee })
    flash(setFeeSaved)
  }

  const handleAddPack = async () => {
    const c = Number(newCount)
    const p = Number(newPrice)
    if (c > 0 && p > 0) {
      await addSessionPack({ sessionCount: c, price: p })
      setNewCount('')
      setNewPrice('')
      setShowAddPack(false)
    }
  }

  const handleDeletePack = async (id: number) => {
    if (window.confirm('Delete this session pack?')) {
      await deleteSessionPack(id)
    }
  }

  const handleUpdateClassDay = (index: number, type: string) => {
    const updated = [...settings.classDays]
    updated[index] = { ...updated[index], type: type as 'boxing' | 'kickboxing' }
    saveSettings({ ...settings, classDays: updated })
  }

  const handleDeleteClassDay = (index: number) => {
    if (window.confirm('Remove this class day?')) {
      const updated = settings.classDays.filter((_, i) => i !== index)
      saveSettings({ ...settings, classDays: updated })
    }
  }

  const handleAddClassDay = () => {
    const updated = [...settings.classDays, { day: newDay, type: newDayType as 'boxing' | 'kickboxing' }]
    saveSettings({ ...settings, classDays: updated })
    setShowAddDay(false)
  }

  const handleExportReport = async () => {
    setReportMsg('Preparing report...')
    try {
      await downloadReport()
      setReportMsg('Report downloaded! Open it in Excel or Sheets.')
    } catch {
      setReportMsg('Export failed')
    }
    setTimeout(() => setReportMsg(''), 4000)
  }

  const handleBackup = async () => {
    setBackupMsg('Creating backup...')
    try {
      await downloadBackup()
      saveSettings({ ...settings, lastBackupDate: new Date().toISOString() })
      setBackupMsg('Backup downloaded!')
    } catch {
      setBackupMsg('Backup failed')
    }
    setTimeout(() => setBackupMsg(''), 3000)
  }

  const handleRestoreAuto = async () => {
    const json = getWeeklyBackupJSON()
    if (!json) {
      setBackupMsg('No auto-backup saved yet.')
      setTimeout(() => setBackupMsg(''), 3000)
      return
    }
    if (!window.confirm('This will replace ALL current data with the last auto-backup. Continue?')) return
    try {
      setBackupMsg('Restoring auto-backup...')
      await importAllData(json)
      setBackupMsg('Restored! Reloading...')
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      setBackupMsg('Restore failed.')
      setTimeout(() => setBackupMsg(''), 3000)
    }
  }

  const handleRestore = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      if (!window.confirm('This will replace ALL current data. Continue?')) return
      try {
        setBackupMsg('Restoring...')
        const json = await readBackupFile(file)
        await importAllData(json)
        setBackupMsg('Restored! Reloading...')
        setTimeout(() => window.location.reload(), 1500)
      } catch {
        setBackupMsg('Restore failed. Invalid file.')
        setTimeout(() => setBackupMsg(''), 3000)
      }
    }
    input.click()
  }

  return (
    <PageBg src="./gym-bg.png" opacity={0.82}>
    <div className="text-white page-pad px-4 safe-top">
      <h1 className="text-2xl font-black text-white mb-1">Settings</h1>
      <p className="text-gray-400 text-sm mb-4">Manage your fight club</p>

      <RedDivider />

      {/* Payment Details */}
      <SectionTitle>💳 Payment Details</SectionTitle>
      {(!settings.upiId || !settings.coachPhone) && (
        <div className="rounded-xl p-3 mb-3 bg-amber-500/10 border border-amber-500/30">
          <p className="text-amber-300 text-sm font-medium">
            Add your UPI ID and phone number below so renewal reminders can include your payment details.
          </p>
        </div>
      )}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1">UPI ID</label>
          <div className="flex gap-2">
            <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi"
              className="flex-1 glass-input text-white rounded-xl px-4 py-3 text-base outline-none transition-colors" />
            <button type="button" onClick={handleSaveUpi} className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl btn-impact text-sm shrink-0">{upiSaved ? '✓' : 'Save'}</button>
          </div>
        </div>
        <div>
          <label className="text-gray-400 text-sm font-medium block mb-1">Phone (for Google Pay / PhonePe)</label>
          <div className="flex gap-2">
            <input type="tel" inputMode="numeric" maxLength={10} value={coachPhone} onChange={(e) => setCoachPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210"
              className="flex-1 glass-input text-white rounded-xl px-4 py-3 text-base outline-none transition-colors" />
            <button type="button" onClick={handleSavePhone} className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl btn-impact text-sm shrink-0">{phoneSaved ? '✓' : 'Save'}</button>
          </div>
        </div>
      </div>

      <RedDivider />

      {/* Pricing */}
      <SectionTitle>💰 Pricing</SectionTitle>
      <div className="space-y-3">
        <div className="glass-card rounded-xl p-4">
          <label className="text-gray-400 text-sm font-medium block mb-1">Monthly Fee (₹)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(Number(e.target.value))}
              className="flex-1 glass-input text-white rounded-xl px-4 py-3 text-base outline-none transition-colors"
            />
            <button
              type="button"
              onClick={handleSaveFee}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl btn-impact text-sm shrink-0"
            >
              {feeSaved ? '✓' : 'Save'}
            </button>
          </div>
        </div>

        {/* Session Packs */}
        <div>
          <p className="text-gray-400 text-sm font-medium mb-2">Session Packs</p>
          <div className="space-y-2">
            {packs.map((p) => (
              <PackItem
                key={p.id}
                pack={p}
                onUpdate={(count, price) => updateSessionPack(p.id!, { sessionCount: count, price })}
                onDelete={() => handleDeletePack(p.id!)}
              />
            ))}
          </div>

          {showAddPack ? (
            <div className="glass-card rounded-xl p-3 mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Sessions</label>
                  <input
                    type="number"
                    value={newCount}
                    onChange={(e) => setNewCount(e.target.value)}
                    placeholder="10"
                    className="w-full glass-input text-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="5000"
                    className="w-full glass-input text-white rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleAddPack} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm btn-impact">
                  Add Pack
                </button>
                <button type="button" onClick={() => setShowAddPack(false)} className="px-4 glass-btn text-gray-400 font-bold py-2.5 rounded-xl text-sm btn-impact">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddPack(true)}
              className="mt-2 w-full glass-card border-dashed text-gray-400 font-medium py-3 rounded-xl btn-impact text-sm"
            >
              + Add Session Pack
            </button>
          )}
        </div>
      </div>

      <RedDivider />

      {/* Class Schedule */}
      <SectionTitle>📅 Class Schedule</SectionTitle>
      <div className="space-y-2">
        {settings.classDays.map((cd, i) => (
          <ClassDayItem
            key={`${cd.day}-${i}`}
            day={cd.day}
            type={cd.type}
            onUpdate={(type) => handleUpdateClassDay(i, type)}
            onDelete={() => handleDeleteClassDay(i)}
          />
        ))}

        {showAddDay ? (
          <div className="glass-card rounded-xl p-3 space-y-3">
            <div>
              <label className="text-gray-500 text-xs block mb-1">Day</label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                className="w-full glass-input text-white rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d.toLowerCase()}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-xs block mb-1">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {['boxing', 'kickboxing'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewDayType(t)}
                    className={`py-2.5 rounded-xl font-bold text-sm capitalize transition-all duration-200 ${
                      newDayType === t
                        ? 'bg-red-600 text-white'
                        : 'glass-btn text-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddClassDay} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm btn-impact">
                Add Day
              </button>
              <button type="button" onClick={() => setShowAddDay(false)} className="px-4 glass-btn text-gray-400 font-bold py-2.5 rounded-xl text-sm btn-impact">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddDay(true)}
            className="w-full glass-card border-dashed text-gray-400 font-medium py-3 rounded-xl btn-impact text-sm"
          >
            + Add Class Day
          </button>
        )}
      </div>

      <RedDivider />

      {/* Reports */}
      <SectionTitle>📊 Reports</SectionTitle>
      <div className="glass-card rounded-xl p-4 space-y-3">
        <p className="text-gray-400 text-sm">
          A readable spreadsheet of every fighter — plan, expiry, who's paid or due, sessions left,
          and attendance. Opens in Excel, Google Sheets or Numbers on any phone.
        </p>
        <button
          type="button"
          onClick={handleExportReport}
          className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black py-4 rounded-xl btn-impact text-base uppercase tracking-wider shadow-lg shadow-amber-900/20"
        >
          Export Report (Excel / CSV)
        </button>
        {reportMsg && (
          <p className="text-center text-amber-400 text-sm font-medium">{reportMsg}</p>
        )}
      </div>

      <RedDivider />

      {/* Data Management */}
      <SectionTitle>💾 Backup &amp; Restore</SectionTitle>

      <div className="glass-card rounded-xl p-4 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm">Automatic backup</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {autoBackupDate
                ? `Saved automatically on ${format(new Date(autoBackupDate), 'd MMM yyyy, h:mm a')}`
                : 'Saves a safety copy on this phone every 7 days.'}
            </p>
          </div>
          <span className="shrink-0 text-green-400 text-xs font-bold bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1">
            ON
          </span>
        </div>
        {autoBackupDate && (
          <button
            type="button"
            onClick={handleRestoreAuto}
            className="mt-3 w-full glass-btn text-gray-200 font-bold py-3 rounded-xl btn-impact text-sm"
          >
            Restore Last Auto-Backup
          </button>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-gray-400 text-sm">
          A full backup file to move everything to a new phone or recover after a reinstall.
          Keep it safe — it restores all your data exactly.
        </p>
        <button
          type="button"
          onClick={handleBackup}
          className="w-full glass-card text-gray-200 font-bold py-4 rounded-xl btn-impact text-base"
        >
          Backup All Data (file)
        </button>
        <button
          type="button"
          onClick={handleRestore}
          className="w-full glass-card text-gray-300 font-bold py-4 rounded-xl btn-impact text-base"
        >
          Restore from Backup
        </button>
        {backupMsg && (
          <p className="text-center text-amber-400 text-sm font-medium">{backupMsg}</p>
        )}
        {settings.lastBackupDate && (
          <p className="text-gray-500 text-xs text-center">
            Last backup: {format(new Date(settings.lastBackupDate), 'd MMM yyyy, h:mm a')}
          </p>
        )}
      </div>

      <RedDivider />

      {/* About */}
      <div className="pb-8 flex flex-col items-center">
        <BrandTitle align="center" size="md" className="mb-3" />
        <p className="text-gray-500 text-xs">Version 1.0.0</p>
        <p className="text-amber-500/50 text-[10px] font-medium tracking-[0.2em] uppercase mt-2">
          Train hard · Stay sharp
        </p>
      </div>
    </div>
    </PageBg>
  )
}
