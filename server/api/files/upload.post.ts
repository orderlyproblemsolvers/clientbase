import { PutObjectCommand } from '@aws-sdk/client-s3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { getB2Client } from '../../utils/b2Client'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const userId = user.sub ?? user.id
  if (!userId) throw createError({ statusCode: 401, message: 'Could not resolve user ID' })

  const formData = await readMultipartFormData(event)
  if (!formData) throw createError({ statusCode: 400, message: 'No file received' })

  const fileField  = formData.find(f => f.name === 'file')
  const projectId  = formData.find(f => f.name === 'projectId')?.data.toString()
  const clientId   = formData.find(f => f.name === 'clientId')?.data.toString()

  if (!fileField || !projectId) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const config     = useRuntimeConfig()
  const ext        = fileField.filename?.split('.').pop()
  const uniqueName = `${crypto.randomUUID()}.${ext}`
  const filePath   = `${userId}/${projectId}/${uniqueName}`

  const client = getB2Client()

  await client.send(new PutObjectCommand({
    Bucket:      config.b2BucketName,
    Key:         filePath,
    Body:        fileField.data,
    ContentType: fileField.type,
  }))

  const supabase = await serverSupabaseClient(event)
  const { data, error } = await supabase
    .from('files')
    .insert({
      project_id: projectId,
      client_id:  clientId || null,
      file_name:  fileField.filename,
      file_path:  filePath,
      file_type:  fileField.type,
      user_id:    userId,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { file: data }
})