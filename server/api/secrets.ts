import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import crypto from 'node:crypto'

// ─── Encryption ───────────────────────────────────────────────────────────────
function getKey(raw: string): Buffer {
  return Buffer.from(raw.padEnd(32, '0').slice(0, 32))
}

function encrypt(text: string, rawKey: string): string {
  const iv     = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(rawKey), iv)
  let enc      = cipher.update(text, 'utf8', 'hex')
  enc         += cipher.final('hex')
  const tag    = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${tag}:${enc}`
}

function decrypt(stored: string, rawKey: string): string {
  try {
    const [ivHex, tagHex, enc] = stored.split(':')
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getKey(rawKey),
      Buffer.from(ivHex, 'hex')
    )
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8')
  } catch {
    // Legacy: value was stored unencrypted or with old scheme — return as-is
    return stored
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = await serverSupabaseClient(event)
  const config   = useRuntimeConfig()
  const encKey   = config.secretsEncryptionKey || 'change-me-in-production-32chars'

  // ── GET ────────────────────────────────────────────────────────────────────
  if (event.method === 'GET') {
    const { client_id, project_id } = getQuery(event) as {
      client_id?: string
      project_id?: string
    }

    if (!client_id && !project_id) {
      throw createError({ statusCode: 400, message: 'client_id or project_id required' })
    }

    const q = supabase
      .from('secrets')
      .select('id, key_name, value, created_at, client_id, project_id')
      .order('created_at', { ascending: false })

    const { data, error } = project_id
      ? await q.eq('project_id', project_id)
      : await q.eq('client_id', client_id!)

    if (error) throw createError({ statusCode: 500, message: error.message })

    return (data ?? []).map((s: any) => ({
      id:         s.id,
      key_name:   s.key_name,
      client_id:  s.client_id,
      project_id: s.project_id,
      created_at: s.created_at,
      value:      decrypt(s.value, encKey),
    }))
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (event.method === 'POST') {
    const { client_id, project_id, key_name, value } = await readBody(event)

    if (!key_name || !value) {
      throw createError({ statusCode: 400, message: 'key_name and value are required' })
    }

    const { error } = await supabase.from('secrets').insert({
      client_id:  client_id  ?? null,
      project_id: project_id ?? null,
      key_name,
      value:      encrypt(value, encKey),
    })

    if (error) throw createError({ statusCode: 500, message: error.message })
    return { success: true }
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (event.method === 'DELETE') {
    const { id } = getQuery(event) as { id: string }
    if (!id) throw createError({ statusCode: 400, message: 'id is required' })

    const { error } = await supabase.from('secrets').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return { success: true }
  }
})