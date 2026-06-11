// composables/useQuickEngagementParser.ts

interface ParsedEngagement {
  client_name?: string
  client_website?: string
  client_category?: string
  project_name?: string
  project_description?: string
  budget?: number | null
  currency?: string
  start_date?: string
  end_date?: string
  missing_fields: string[]  // suggested onboarding questions
}

const CURRENCY_MAP: Record<string, string> = {
  '₦': 'NGN', 'N': 'NGN', 'naira': 'NGN',
  '$': 'USD', 'usd': 'USD', 'dollar': 'USD',
  '£': 'GBP', 'gbp': 'GBP', 'pound': 'GBP',
  '€': 'EUR', 'eur': 'EUR', 'euro': 'EUR',
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Educational: ['school', 'university', 'education', 'academy', 'learning'],
  Fintech: ['fintech', 'bank', 'payment', 'crypto', 'wallet'],
  Internal: ['internal', 'ops', 'operations'],
  Personal: ['personal', 'portfolio', 'blog'],
  Development: ['app', 'website', 'web', 'software', 'saas', 'development'],
  Design: ['design', 'branding', 'logo', 'ui/ux', 'graphic'],
}

export function useQuickEngagementParser(input: string): ParsedEngagement | null {
  if (!input.trim()) return null

  const result: ParsedEngagement = {
    missing_fields: [],
  }

  let text = input.trim()

  // ---- 1. Extract Website ----
  const urlRegex = /(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?/gi
  const urlMatch = text.match(urlRegex)
  if (urlMatch) {
    result.client_website = urlMatch[0].replace(/^(?!https?:\/\/)/, 'https://')
    text = text.replace(urlMatch[0], '')
  }

  // ---- 2. Extract Currency & Budget ----
  let budgetAmount: number | null = null
  let budgetCurrency = 'NGN'
  // Pattern: optional currency symbol, then number with k/m/b suffix
  const budgetRegex = /([₦$£€]?\s*\d+(?:[.,]\d+)?\s*(k|m|b|thousand|million|billion)?)\s*(naira|usd|gbp|eur|dollars?|pounds?|euros?)?\b/gi
  const budgetMatches = [...text.matchAll(budgetRegex)]
  if (budgetMatches.length > 0) {
    const match = budgetMatches[0]
    let amountStr = match[1].replace(/[₦$£€\s]/g, '')
    const suffix = (match[2] || '').toLowerCase()
    const currencyWord = (match[3] || '').toLowerCase()

    // Parse number
    amountStr = amountStr.replace(/,/g, '')
    let amount = parseFloat(amountStr)
    if (suffix === 'k' || suffix === 'thousand') amount *= 1_000
    else if (suffix === 'm' || suffix === 'million') amount *= 1_000_000
    else if (suffix === 'b' || suffix === 'billion') amount *= 1_000_000_000

    budgetAmount = Math.round(amount)

    // Detect currency from symbol or word
    if (match[0].includes('₦') || currencyWord.includes('naira')) budgetCurrency = 'NGN'
    else if (match[0].includes('$') || currencyWord.includes('dollar') || currencyWord.includes('usd')) budgetCurrency = 'USD'
    else if (match[0].includes('£') || currencyWord.includes('pound') || currencyWord.includes('gbp')) budgetCurrency = 'GBP'
    else if (match[0].includes('€') || currencyWord.includes('euro') || currencyWord.includes('eur')) budgetCurrency = 'EUR'

    result.budget = budgetAmount
    result.currency = budgetCurrency
    text = text.replace(match[0], '')
  }

  // ---- 3. Extract Dates ----
  const datePatterns = [
    // ISO: 2024-07-30
    { regex: /(\d{4}-\d{2}-\d{2})/, type: 'iso' },
    // "due July 30", "due 30 July", "due 30th July"
    { regex: /due\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*\d{4}?)/i, type: 'natural' },
    // "deadline July 30"
    { regex: /deadline\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?))/i, type: 'natural' },
    // "starting Monday", "starting next Monday"
    { regex: /starting\s+(next\s+)?(\w+day)/i, type: 'relative' },
    // "in 2 weeks"
    { regex: /in\s+(\d+)\s+weeks?/i, type: 'relative' },
    // "next week"
    { regex: /next\s+week/i, type: 'relative' },
  ]

  let startDate: string | null = null
  let endDate: string | null = null

  for (const pattern of datePatterns) {
    const match = text.match(pattern.regex)
    if (match) {
      const dateStr = match[1] || match[0]
      const parsed = parseDate(dateStr, pattern.type)
      if (parsed) {
        // Assign to start_date if not set, else end_date
        if (!startDate) startDate = parsed
        else if (!endDate) endDate = parsed
      }
      text = text.replace(match[0], '')
      if (startDate && endDate) break
    }
  }

  if (startDate) result.start_date = startDate
  if (endDate) result.end_date = endDate

  // ---- 4. Extract Client Name ----
  // Heuristic: look for "for [Client Name]" or capitalized words at start
  let clientName = ''
  const forMatch = text.match(/for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/)
  if (forMatch) {
    clientName = forMatch[1]
    text = text.replace(forMatch[0], '')
  } else {
    // Use first proper noun sequence
    const properNouns = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/)
    if (properNouns) {
      clientName = properNouns[1]
      text = text.replace(properNouns[0], '')
    }
  }
  result.client_name = clientName || undefined

  // ---- 5. Extract Project Name ----
  // "called [Project]" or "named [Project]" or use client name + "Project"
  const namedMatch = text.match(/(?:called|named)\s+([A-Za-z0-9\s-]+)/i)
  if (namedMatch) {
    result.project_name = namedMatch[1].trim()
    text = text.replace(namedMatch[0], '')
  } else {
    result.project_name = clientName ? `${clientName} Project` : undefined
  }

  // ---- 6. Category ----
  let category = 'Development'
  const lowerText = text.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      category = cat
      break
    }
  }
  result.client_category = category

  // ---- 7. Description ----
  const remaining = text.replace(/\s+/g, ' ').trim()
  result.project_description = remaining || undefined

  // ---- 8. Identify missing info for onboarding ----
  if (!result.client_name) result.missing_fields.push('Client Name')
  if (!result.budget) result.missing_fields.push('Project Budget')
  if (!result.end_date) result.missing_fields.push('Expected Deadline')
  if (!result.client_website) result.missing_fields.push('Client Website')
  if (!result.project_description || result.project_description.length < 20) result.missing_fields.push('Project Details / Scope')

  return result
}

// Helper: parse natural/relative dates
function parseDate(input: string, type: string): string | null {
  const today = new Date()
  if (type === 'iso') {
    const d = new Date(input)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  }
  if (type === 'natural') {
    // Use Date.parse after cleaning
    const cleaned = input.replace(/(\d+)(st|nd|rd|th)/, '$1')
    const d = new Date(cleaned)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  if (type === 'relative') {
    let days = 0
    if (input.includes('week')) {
      const weeks = input.match(/(\d+)/)
      days = weeks ? parseInt(weeks[1]) * 7 : 7
    } else if (input.includes('day')) {
      const dayName = input.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i)
      if (dayName) {
        const targetDay = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(dayName[0].toLowerCase())
        if (targetDay !== -1) {
          const currentDay = today.getDay()
          days = (targetDay + 7 - currentDay) % 7
          if (days === 0) days = 7 // next week
        }
      }
    }
    if (days > 0) {
      const d = new Date(today.getTime() + days * 86400000)
      return d.toISOString().split('T')[0]
    }
  }
  return null
}