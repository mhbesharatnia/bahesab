import { AwsClient } from 'aws4fetch'
import type { ArvanSyncConfig, BackupDocumentV1 } from '../lib/types'

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '')
}

function objectUrl(cfg: Pick<ArvanSyncConfig, 'endpoint' | 'bucket' | 'objectKey'>): string {
  const endpoint = normalizeEndpoint(cfg.endpoint)
  const key = cfg.objectKey.replace(/^\/+/, '')
  return `${endpoint}/${cfg.bucket}/${key}`
}

function client(cfg: ArvanSyncConfig): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.accessKeyId.trim(),
    secretAccessKey: cfg.secretAccessKey.trim(),
    region: cfg.region.trim() || 'ir-thr-at1',
    service: 's3',
  })
}

export function assertArvanConfig(cfg: ArvanSyncConfig): void {
  if (!cfg.endpoint.trim()) throw new Error('آدرس endpoint آروان خالی است')
  if (!cfg.bucket.trim()) throw new Error('نام باکت خالی است')
  if (!cfg.objectKey.trim()) throw new Error('مسیر فایل (object key) خالی است')
  if (!cfg.accessKeyId.trim() || !cfg.secretAccessKey.trim()) {
    throw new Error('کلید دسترسی آروان ناقص است')
  }
}

export async function arvanGetBackup(
  cfg: ArvanSyncConfig,
): Promise<{ doc: BackupDocumentV1 | null; etag: string | null }> {
  assertArvanConfig(cfg)
  const aws = client(cfg)
  const res = await aws.fetch(objectUrl(cfg), { method: 'GET' })
  if (res.status === 404) return { doc: null, etag: null }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`خواندن از آروان ناموفق (${res.status})${text ? `: ${text.slice(0, 120)}` : ''}`)
  }
  const doc = (await res.json()) as BackupDocumentV1
  return { doc, etag: res.headers.get('etag') }
}

export async function arvanPutBackup(cfg: ArvanSyncConfig, doc: BackupDocumentV1): Promise<void> {
  assertArvanConfig(cfg)
  const aws = client(cfg)
  const body = JSON.stringify(doc)
  const res = await aws.fetch(objectUrl(cfg), {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`نوشتن روی آروان ناموفق (${res.status})${text ? `: ${text.slice(0, 120)}` : ''}`)
  }
}

/** Stable hash of ledger content (ignores exportedAt). */
export async function hashBackupContent(doc: BackupDocumentV1): Promise<string> {
  const { exportedAt: _e, ...rest } = doc
  const payload = JSON.stringify(rest)
  const data = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
