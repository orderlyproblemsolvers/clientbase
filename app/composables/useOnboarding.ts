export type FieldType =
  | 'text' | 'textarea' | 'email' | 'phone'
  | 'url'  | 'number'   | 'date'  | 'select' | 'file'

export interface FormField {
  id:            string
  type:          FieldType
  label:         string
  placeholder:   string
  required:      boolean
  options:       string[]
  position:      number
  // file-specific
  maxFiles:      number
  acceptedTypes: string[]   // e.g. ['image/*', '.pdf', '.doc', '.docx']
}

export const FILE_TYPE_OPTIONS = [
  { label: 'Images',       value: 'image/*' },
  { label: 'PDFs',         value: '.pdf' },
  { label: 'Word Docs',    value: '.doc,.docx'},
  { label: 'Spreadsheets', value: '.xls,.xlsx,.csv' },
  { label: 'Videos',       value: 'video/*'                        },
  { label: 'Any file',     value: '*'  },
]

export const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: 'text',     label: 'Short Text',   icon: 'i-heroicons-bars-2'          },
  { type: 'textarea', label: 'Long Text',    icon: 'i-heroicons-bars-4'          },
  { type: 'email',    label: 'Email',        icon: 'i-heroicons-envelope'        },
  { type: 'phone',    label: 'Phone',        icon: 'i-heroicons-phone'           },
  { type: 'url',      label: 'Link / URL',   icon: 'i-heroicons-link'            },
  { type: 'number',   label: 'Number',       icon: 'i-heroicons-hashtag'         },
  { type: 'date',     label: 'Date',         icon: 'i-heroicons-calendar'        },
  { type: 'select',   label: 'Dropdown',     icon: 'i-heroicons-chevron-up-down' },
  { type: 'file',     label: 'File Upload',  icon: 'i-heroicons-paper-clip'      },
]

export const FORM_TEMPLATES: {
  name: string; description: string; icon: string; fields: Omit<FormField, 'id'>[]
}[] = [
  {
    name:        'Web Design Brief',
    description: 'Layout, brand, pages, deadline, budget',
    icon:        'i-heroicons-paint-brush',
    fields: [
      { type: 'text',     label: 'Business Name',            placeholder: 'Your company or brand name',       required: true,  options: [], position: 0,  maxFiles: 1, acceptedTypes: []           },
      { type: 'email',    label: 'Contact Email',             placeholder: 'hello@example.com',                required: true,  options: [], position: 1,  maxFiles: 1, acceptedTypes: []           },
      { type: 'phone',    label: 'Phone Number',              placeholder: '+234...',                          required: false, options: [], position: 2,  maxFiles: 1, acceptedTypes: []           },
      { type: 'textarea', label: 'About Your Business',       placeholder: 'What does your business do?',      required: true,  options: [], position: 3,  maxFiles: 1, acceptedTypes: []           },
      { type: 'textarea', label: 'Project Goals',             placeholder: 'What should the website achieve?', required: true,  options: [], position: 4,  maxFiles: 1, acceptedTypes: []           },
      { type: 'textarea', label: 'Target Audience',           placeholder: 'Who are your customers?',          required: false, options: [], position: 5,  maxFiles: 1, acceptedTypes: []           },
      { type: 'url',      label: 'Inspiration Website 1',     placeholder: 'https://...',                      required: false, options: [], position: 6,  maxFiles: 1, acceptedTypes: []           },
      { type: 'url',      label: 'Inspiration Website 2',     placeholder: 'https://...',                      required: false, options: [], position: 7,  maxFiles: 1, acceptedTypes: []           },
      { type: 'select',   label: 'Number of Pages',           placeholder: '',                                 required: false, options: ['1–3','4–6','7–10','10+'], position: 8, maxFiles: 1, acceptedTypes: [] },
      { type: 'number',   label: 'Budget (NGN)',               placeholder: '0',                                required: false, options: [], position: 9,  maxFiles: 1, acceptedTypes: []           },
      { type: 'date',     label: 'Expected Launch Date',       placeholder: '',                                 required: false, options: [], position: 10, maxFiles: 1, acceptedTypes: []           },
      { type: 'file',     label: 'Brand Assets',               placeholder: '',                                 required: false, options: [], position: 11, maxFiles: 5, acceptedTypes: ['image/*', '.pdf'] },
      { type: 'textarea', label: 'Anything Else?',             placeholder: 'Any other details...',             required: false, options: [], position: 12, maxFiles: 1, acceptedTypes: []           },
    ],
  },
  {
    name:        'Branding Brief',
    description: 'Logo, colours, tone of voice, references',
    icon:        'i-heroicons-sparkles',
    fields: [
      { type: 'text',     label: 'Brand / Business Name',   placeholder: '',                                        required: true,  options: [], position: 0,  maxFiles: 1, acceptedTypes: []             },
      { type: 'email',    label: 'Contact Email',            placeholder: '',                                        required: true,  options: [], position: 1,  maxFiles: 1, acceptedTypes: []             },
      { type: 'textarea', label: 'Brand Story',              placeholder: 'How did the business start?',             required: true,  options: [], position: 2,  maxFiles: 1, acceptedTypes: []             },
      { type: 'textarea', label: 'Target Audience',          placeholder: 'Age, interests, location…',               required: true,  options: [], position: 3,  maxFiles: 1, acceptedTypes: []             },
      { type: 'select',   label: 'Brand Tone',               placeholder: '',                                        required: false, options: ['Professional','Playful','Bold','Minimal','Luxury','Friendly'], position: 4, maxFiles: 1, acceptedTypes: [] },
      { type: 'textarea', label: 'Colour Preferences',       placeholder: 'Any colours you love or hate?',           required: false, options: [], position: 5,  maxFiles: 1, acceptedTypes: []             },
      { type: 'url',      label: 'Brand Inspiration 1',      placeholder: 'https://...',                             required: false, options: [], position: 6,  maxFiles: 1, acceptedTypes: []             },
      { type: 'url',      label: 'Brand Inspiration 2',      placeholder: 'https://...',                             required: false, options: [], position: 7,  maxFiles: 1, acceptedTypes: []             },
      { type: 'file',     label: 'Existing Brand Assets',    placeholder: '',                                        required: false, options: [], position: 8,  maxFiles: 5, acceptedTypes: ['image/*', '.pdf'] },
      { type: 'number',   label: 'Budget (NGN)',              placeholder: '0',                                       required: false, options: [], position: 9,  maxFiles: 1, acceptedTypes: []             },
      { type: 'date',     label: 'Deadline',                  placeholder: '',                                        required: false, options: [], position: 10, maxFiles: 1, acceptedTypes: []             },
    ],
  },
  {
    name:        'Development Project',
    description: 'Tech stack, features, integrations, timeline',
    icon:        'i-heroicons-code-bracket',
    fields: [
      { type: 'text',     label: 'Project Name',              placeholder: '',                                        required: true,  options: [], position: 0,  maxFiles: 1, acceptedTypes: [] },
      { type: 'email',    label: 'Contact Email',              placeholder: '',                                        required: true,  options: [], position: 1,  maxFiles: 1, acceptedTypes: [] },
      { type: 'textarea', label: 'What Are We Building?',      placeholder: 'Describe the app or system',              required: true,  options: [], position: 2,  maxFiles: 1, acceptedTypes: [] },
      { type: 'textarea', label: 'Key Features Required',      placeholder: 'List the core features',                  required: true,  options: [], position: 3,  maxFiles: 1, acceptedTypes: [] },
      { type: 'textarea', label: 'Integrations Needed',        placeholder: 'e.g. Paystack, WhatsApp API',             required: false, options: [], position: 4,  maxFiles: 1, acceptedTypes: [] },
      { type: 'select',   label: 'Platform',                   placeholder: '',                                        required: false, options: ['Web App','Mobile App','Both','API only'], position: 5, maxFiles: 1, acceptedTypes: [] },
      { type: 'number',   label: 'Budget (NGN)',                placeholder: '0',                                       required: false, options: [], position: 7,  maxFiles: 1, acceptedTypes: [] },
      { type: 'date',     label: 'Target Launch Date',          placeholder: '',                                        required: false, options: [], position: 8,  maxFiles: 1, acceptedTypes: [] },
      { type: 'url',      label: 'Reference App / Site',        placeholder: 'https://...',                             required: false, options: [], position: 9,  maxFiles: 1, acceptedTypes: [] },
      { type: 'file',     label: 'Wireframes / Mockups',        placeholder: '',                                        required: false, options: [], position: 10, maxFiles: 10, acceptedTypes: ['image/*', '.pdf'] },
    ],
  },
  {
    name:        'General Retainer',
    description: 'Scope, deliverables, billing cycle',
    icon:        'i-heroicons-arrow-path',
    fields: [
      { type: 'text',     label: 'Company Name',              placeholder: '',  required: true,  options: [], position: 0, maxFiles: 1, acceptedTypes: [] },
      { type: 'email',    label: 'Primary Contact Email',     placeholder: '',  required: true,  options: [], position: 1, maxFiles: 1, acceptedTypes: [] },
      { type: 'phone',    label: 'Phone Number',              placeholder: '',  required: false, options: [], position: 2, maxFiles: 1, acceptedTypes: [] },
      { type: 'textarea', label: 'Services Needed',           placeholder: 'What ongoing support do you need?', required: true, options: [], position: 3, maxFiles: 1, acceptedTypes: [] },
      { type: 'textarea', label: 'Expected Deliverables',     placeholder: 'What should be delivered each month?', required: true, options: [], position: 4, maxFiles: 1, acceptedTypes: [] },
      { type: 'select',   label: 'Billing Cycle',             placeholder: '',  required: false, options: ['Monthly','Quarterly','Weekly'], position: 5, maxFiles: 1, acceptedTypes: [] },
      { type: 'number',   label: 'Monthly Budget (NGN)',      placeholder: '0', required: false, options: [], position: 6, maxFiles: 1, acceptedTypes: [] },
      { type: 'date',     label: 'Start Date',                placeholder: '',  required: false, options: [], position: 7, maxFiles: 1, acceptedTypes: [] },
    ],
  },
]

export const useOnboarding = () => {
  const newFieldId = () => `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

  const blankField = (position = 0): FormField => ({
    id:            newFieldId(),
    type:          'text',
    label:         '',
    placeholder:   '',
    required:      false,
    options:       [],
    position,
    maxFiles:      1,
    acceptedTypes: [],
  })

  const templateFields = (templateName: string): FormField[] => {
    const tpl = FORM_TEMPLATES.find(t => t.name === templateName)
    if (!tpl) return []
    return tpl.fields.map(f => ({ ...f, id: newFieldId() }))
  }

  const copyFields = (sourceFields: FormField[]): FormField[] =>
    sourceFields.map(f => ({ ...f, id: newFieldId() }))

  const moveUp = (fields: FormField[], idx: number) => {
    if (idx === 0) return fields
    const arr = [...fields]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    return arr.map((f, i) => ({ ...f, position: i }))
  }

  const moveDown = (fields: FormField[], idx: number) => {
    if (idx === fields.length - 1) return fields
    const arr = [...fields]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    return arr.map((f, i) => ({ ...f, position: i }))
  }

  // Build accept string for HTML input
  const acceptString = (types: string[]): string => {
    if (!types.length || types.includes('*')) return '*'
    return types.join(',')
  }

  return { newFieldId, blankField, templateFields, copyFields, moveUp, moveDown, acceptString }
}