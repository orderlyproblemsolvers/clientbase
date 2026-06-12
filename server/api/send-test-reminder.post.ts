export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { project_id, recipient_email } = body

  if (!project_id) {
    throw createError({ statusCode: 400, message: 'project_id is required' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      message: 'Server configuration error: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    })
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/send-test-reminder`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project_id, override_email: recipient_email }),
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw createError({
      statusCode: response.status,
      message: err.error || 'Failed to send test email',
    })
  }

  return { success: true }
})