import { format } from 'date-fns'

export function buildRenewalMessage(
  memberName: string,
  upiId: string,
  coachPhone: string,
  amount: number,
  endDate?: string | null,
): string {
  const fee = `₹${amount.toLocaleString('en-IN')}/-`
  const firstName = memberName.trim().split(/\s+/)[0] || memberName
  const today = format(new Date(), 'yyyy-MM-dd')

  let statusLine = 'Your kickboxing plan has ended.'
  let amountLabel = 'Fees due'

  if (endDate) {
    const pretty = format(new Date(endDate + 'T00:00:00'), 'd MMMM yyyy')
    if (endDate > today) {
      statusLine = `Your kickboxing plan ends on ${pretty}.`
      amountLabel = 'Renewal'
    } else if (endDate === today) {
      statusLine = `Your kickboxing plan ends today (${pretty}).`
      amountLabel = 'Renewal'
    } else {
      statusLine = `Your kickboxing plan ended on ${pretty}.`
      amountLabel = 'Fees due'
    }
  }

  return `Hey ${firstName},

${statusLine}

${amountLabel}: ${fee}

UPI: ${upiId}
GPay / PhonePe: ${coachPhone}

Reply here once paid. See you in class!`
}

export function openWhatsAppReminder(
  phone: string,
  memberName: string,
  upiId: string,
  coachPhone: string,
  amount: number,
  endDate?: string | null,
): void {
  const cleaned = phone.replace(/\D/g, '')
  const withPrefix = cleaned.startsWith('91') ? cleaned : `91${cleaned}`
  const message = buildRenewalMessage(memberName, upiId, coachPhone, amount, endDate)
  const url = `https://wa.me/${withPrefix}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}
