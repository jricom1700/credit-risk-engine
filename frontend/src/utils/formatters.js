import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatMXNValue(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatMXN(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00 MXN'
  return formatMXNValue(amount) + ' MXN'
}

export function formatMXNCompact(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0 MXN'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '0.0%'
  return `${Number(value).toFixed(decimals)}%`
}

export function getCNBVBadgeColor(rating) {
  switch (rating) {
    case 'A-1':
    case 'A-2':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    case 'B-1':
    case 'B-2':
      return 'bg-teal-500/20 text-teal-400 border-teal-500/40'
    case 'C-1':
    case 'C-2':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    case 'D':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/40'
    case 'E':
      return 'bg-rose-500/20 text-rose-400 border-rose-500/40'
    default:
      return 'bg-slate-700 text-slate-300 border-slate-600'
  }
}

export function getDecisionBadgeColor(decision) {
  switch (decision) {
    case 'APROBADO':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
    case 'REVISIÓN MANUAL':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/50'
    case 'RECHAZADO':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/50'
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700'
  }
}
