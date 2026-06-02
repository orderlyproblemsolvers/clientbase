import crypto from 'node:crypto'

function getKey(raw: string): Buffer {
  return Buffer.from(raw.padEnd(32, '0').slice(0, 32))
}

export function encrypt(text: string, rawKey: string): string {
  const iv     = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(rawKey), iv)
  let enc      = cipher.update(text, 'utf8', 'hex')
  enc         += cipher.final('hex')
  const tag    = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${tag}:${enc}`
}

export function decrypt(stored: string, rawKey: string): string {
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
    return stored
  }
}