import type { Severity, ValidationCategory, Verdict } from '../types'

export const TOOL_NAMES: Record<string, string> = {
  pointer: 'Pointer (V)',
  highlight: 'Text Highlight (H)',
  rectangle: 'Rectangle (R)',
  validation: 'Validation (V)',
  comment: 'Comment (C)',
  erase: 'Erase (E)',
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  info: '#93c5fd',
  warning: '#fdba74',
  error: '#fca5a5',
  success: '#86efac',
}

export const SEVERITY_BORDERS: Record<Severity, string> = {
  info: '#60a5fa',
  warning: '#f97316',
  error: '#ef4444',
  success: '#22c55e',
}

export const SEVERITY_ICONS: Record<Severity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  success: '✅',
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
  success: 'Success',
}

export const HIGHLIGHT_COLORS = ['#fef08a', '#86efac', '#93c5fd', '#fca5a5']

export const ANNOTATION_COLORS: Record<string, string> = {
  highlight: '#fef08a',
  rectangle: '#93c5fd',
}

export const VALIDATION_MESSAGES: Array<{
  severity: Severity
  category: ValidationCategory
  message: string
}> = [
  { severity: 'error', category: 'financial', message: 'Invoice Number Missing' },
  { severity: 'error', category: 'financial', message: 'Invalid Date' },
  { severity: 'error', category: 'financial', message: 'Incorrect GST Number' },
  { severity: 'warning', category: 'missing-data', message: 'Address Missing' },
  { severity: 'error', category: 'personal-info', message: 'Wrong PAN' },
  { severity: 'error', category: 'financial', message: 'Incorrect Invoice Total' },
  { severity: 'info', category: 'legal', message: 'Missing Signature' },
  { severity: 'warning', category: 'compliance', message: 'Non-compliance Detected' },
  { severity: 'success', category: 'grammar', message: 'Grammar Verified' },
  { severity: 'error', category: 'personal-info', message: 'Sensitive Data Exposed' },
  { severity: 'warning', category: 'medical', message: 'Invalid Medical Code' },
  { severity: 'info', category: 'legal', message: 'Disclaimer Missing' },
  { severity: 'error', category: 'financial', message: 'Tax Calculation Error' },
  { severity: 'warning', category: 'missing-data', message: 'Contact Information Missing' },
  { severity: 'info', category: 'compliance', message: 'Regulatory Check Pending' },
]

export const CATEGORY_LABELS: Record<ValidationCategory, string> = {
  grammar: 'Grammar',
  financial: 'Financial',
  legal: 'Legal',
  'missing-data': 'Missing Data',
  compliance: 'Compliance',
  'personal-info': 'Personal Information',
  medical: 'Medical',
  custom: 'Custom',
}

export const CATEGORY_ICONS: Record<ValidationCategory, string> = {
  grammar: '📝',
  financial: '💰',
  legal: '⚖️',
  'missing-data': '📋',
  compliance: '✅',
  'personal-info': '🔒',
  medical: '🏥',
  custom: '🔧',
}

export const VERDICT_COLORS: Record<Verdict, string> = {
  verified: '#22c55e',
  partial: '#eab308',
  unsupported: '#ef4444',
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  verified: 'Verified',
  partial: 'Partial',
  unsupported: 'Unsupported',
}

export const VERDICT_ICONS: Record<Verdict, string> = {
  verified: '✅',
  partial: '⚠️',
  unsupported: '❌',
}

export const DEFAULT_ZOOM = 1.0
export const ZOOM_STEP = 0.25
export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4.0
