import { db } from '../db/database'
import { format } from 'date-fns'

/** Wrap a value for CSV: force text, escape quotes, keep leading zeros in phone. */
function cell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function pretty(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'd MMM yyyy')
  } catch {
    return dateStr
  }
}

/**
 * Builds a coach-friendly report as a CSV (opens in Excel, Google Sheets, Numbers,
 * or any phone spreadsheet app). Two clearly-labelled sections:
 *   1) Fighters — plan, expiry, paid/unpaid status, sessions left, classes attended
 *   2) Attendance log — every class check-in by date
 */
export async function downloadReport(): Promise<void> {
  const [members, subscriptions, attendance, payments] = await Promise.all([
    db.members.toArray(),
    db.subscriptions.toArray(),
    db.attendance.toArray(),
    db.payments.toArray(),
  ])

  const today = todayStr()
  const rows: string[] = []

  // Title
  rows.push(cell(`Coach Somnath's Lodha Park Fight Club — Report (${pretty(today)})`))
  rows.push('')

  // ── Section 1: Fighters ──────────────────────────────────────────────
  rows.push(cell('FIGHTERS'))
  rows.push(
    [
      'Name',
      'Phone',
      'Plan',
      'Start Date',
      'Expiry Date',
      'Status',
      'Payment',
      'Sessions Left',
      'Total Paid (₹)',
      'Classes Attended',
      'Last Attended',
    ]
      .map(cell)
      .join(','),
  )

  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name))

  for (const m of sortedMembers) {
    const mySubs = subscriptions
      .filter((s) => s.memberId === m.id)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
    const latest = mySubs[0]

    const myAttendance = attendance.filter((a) => a.memberId === m.id)
    const attendedCount = myAttendance.length
    const lastAttended =
      myAttendance.length > 0
        ? myAttendance.map((a) => a.date).sort().slice(-1)[0]
        : ''

    const totalPaid = payments
      .filter((p) => p.memberId === m.id)
      .reduce((sum, p) => sum + (p.amount || 0), 0)

    let plan = ''
    let expiry = ''
    let sessionsLeft = ''
    let status = 'No plan'
    let payment = ''

    if (latest) {
      plan = latest.planType === 'monthly' ? 'Monthly' : 'Sessions'
      if (latest.planType === 'monthly') {
        expiry = pretty(latest.endDate)
        const active = latest.endDate ? latest.endDate >= today : false
        status = active ? 'Active' : 'Expired'
        payment = active ? 'Paid' : 'Renewal due'
      } else {
        const left = (latest.totalSessions ?? 0) - (latest.usedSessions ?? 0)
        sessionsLeft = String(left)
        const active = left > 0
        status = active ? 'Active' : 'Used up'
        payment = active ? 'Paid' : 'Renewal due'
      }
    }

    rows.push(
      [
        m.name,
        m.phone,
        plan,
        pretty(latest?.startDate),
        expiry,
        status,
        payment,
        sessionsLeft,
        totalPaid ? totalPaid.toLocaleString('en-IN') : '0',
        String(attendedCount),
        pretty(lastAttended),
      ]
        .map(cell)
        .join(','),
    )
  }

  rows.push('')
  rows.push('')

  // ── Section 2: Attendance log ────────────────────────────────────────
  rows.push(cell('ATTENDANCE LOG'))
  rows.push(['Date', 'Day', 'Class', 'Fighter'].map(cell).join(','))

  const nameById = new Map(members.map((m) => [m.id, m.name]))
  const sortedAttendance = [...attendance].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? 1 : -1,
  )

  for (const a of sortedAttendance) {
    const day = (() => {
      try {
        return format(new Date(a.date + 'T00:00:00'), 'EEEE')
      } catch {
        return ''
      }
    })()
    rows.push(
      [
        pretty(a.date),
        day,
        a.classType.charAt(0).toUpperCase() + a.classType.slice(1),
        nameById.get(a.memberId) ?? `#${a.memberId}`,
      ]
        .map(cell)
        .join(','),
    )
  }

  // BOM so Excel reads ₹ and other UTF-8 characters correctly
  const csv = '\ufeff' + rows.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `fight-club-report-${today}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
