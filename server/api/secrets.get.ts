import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { decrypt } from '../utils/crypto'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = serverSupabaseServiceRole(event)
  const config   = useRuntimeConfig()
  const encKey   = config.secretsEncryptionKey

  const query = getQuery(event) as Record<string, string>

  const projectId = query.project_id && query.project_id !== 'null' && query.project_id !== 'undefined'
    ? query.project_id : null
  const clientId  = query.client_id  && query.client_id  !== 'null' && query.client_id  !== 'undefined'
    ? query.client_id  : null

  if (!projectId && !clientId) {
    throw createError({ statusCode: 400, message: 'project_id or client_id required' })
  }

  let q = supabase
    .from('secrets')
    .select('id, key_name, value, created_at, client_id, project_id')
    .eq('user_id', user.sub)
    .order('created_at', { ascending: false })

  if (projectId) {
    q = q.eq('project_id', projectId)
  } else {
    q = q.eq('client_id', clientId!).is('project_id', null)
  }

  const { data, error } = await q
  if (error) throw createError({ statusCode: 500, message: error.message })

  return (data ?? []).map((s: any) => ({
    id:         s.id,
    key_name:   s.key_name,
    client_id:  s.client_id,
    project_id: s.project_id,
    created_at: s.created_at,
    value:      decrypt(s.value, encKey), // Auto-imported from utils/crypto.ts
  }))
})