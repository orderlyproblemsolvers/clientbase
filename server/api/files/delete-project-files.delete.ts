import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { getB2Client } from '../../utils/b2Client'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const userId = user.sub ?? user.id
  if (!userId) throw createError({ statusCode: 401, message: 'Could not resolve user ID' })

  const { projectId } = getQuery(event)
  if (!projectId) throw createError({ statusCode: 400, message: 'Missing projectId' })

  const supabase = await serverSupabaseClient(event)

  // Only fetch files belonging to this user AND this project
  const { data: files, error } = await supabase
    .from('files')
    .select('id, file_path')
    .eq('project_id', projectId)
    .eq('user_id', userId)

  if (error) throw createError({ statusCode: 500, message: error.message })

  // Nothing to delete — return early
  if (!files?.length) return { success: true, deleted: 0 }

  const config = useRuntimeConfig()
  const client = getB2Client()

  // Delete all objects from B2 in one request
  await client.send(new DeleteObjectsCommand({
    Bucket: config.b2BucketName,
    Delete: {
      Objects: files.map(f => ({ Key: f.file_path })),
    },
  }))

  // Clean up all metadata records
  await supabase
    .from('files')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  return { success: true, deleted: files.length }
})