import { useEffect, useRef, useState } from 'react'
import {
  applyArvanConnectionImport,
  getArvanSyncConfig,
  runArvanSync,
  saveArvanSyncConfig,
} from '../domain/arvan-sync'
import { exportBackup, importBackupReplace } from '../domain/import-export'
import { db, getSettings } from '../lib/db'
import { nowISO } from '../lib/id'
import type { ArvanConnectionExport, ArvanSyncConfig, DisplayUnit, DueMode, Settings } from '../lib/types'

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [arvan, setArvan] = useState<ArvanSyncConfig | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const arvanFileRef = useRef<HTMLInputElement>(null)

  async function reload() {
    setSettings(await getSettings())
    setArvan(await getArvanSyncConfig())
  }

  useEffect(() => {
    void reload()
  }, [])

  async function save(patch: Partial<Pick<Settings, 'displayUnit' | 'dueMode'>>) {
    if (!settings) return
    await db.settings.put({ ...settings, ...patch, updatedAt: nowISO() })
    setMessage('ذخیره شد')
    await reload()
  }

  async function saveArvan(patch: Partial<ArvanSyncConfig>) {
    const next = await saveArvanSyncConfig(patch)
    setArvan(next)
    setMessage('تنظیمات آروان ذخیره شد')
    setError(null)
  }

  if (!settings || !arvan) return <p>در حال بارگذاری…</p>

  return (
    <section>
      <h2>تنظیمات</h2>
      <div className="card-form">
        <label className="field">
          <span>واحد نمایش</span>
          <select
            value={settings.displayUnit}
            onChange={(e) => void save({ displayUnit: e.target.value as DisplayUnit })}
          >
            <option value="toman">تومان</option>
            <option value="rial">ریال</option>
          </select>
        </label>
        <label className="field">
          <span>رفتار سررسید</span>
          <select
            value={settings.dueMode}
            onChange={(e) => void save({ dueMode: e.target.value as DueMode })}
          >
            <option value="confirm">نیاز به تأیید (پیشنهادی)</option>
            <option value="auto">تبدیل خودکار</option>
          </select>
        </label>
      </div>

      <h3>همگام‌سازی آروان (Object Storage)</h3>
      <p className="muted">
        یک فایل JSON مشترک روی باکت آروان. دستگاه جدید با Import اتصال، اول داده را از آروان می‌گیرد (دفترچهٔ خالی
        را روی کلود نمی‌نویسد). بعد از وصل شدن، هر تغییر محلی چند ثانیه بعد و هر ۱ دقیقه همگام می‌شود. کلیدها فقط
        روی همین دستگاه می‌مانند.
      </p>
      <div className="card-form">
        <label className="check">
          <input
            type="checkbox"
            checked={arvan.enabled}
            onChange={(e) => void saveArvan({ enabled: e.target.checked })}
          />
          <span>فعال‌سازی همگام‌سازی</span>
        </label>
        <label className="field">
          <span>Endpoint</span>
          <input
            dir="ltr"
            value={arvan.endpoint}
            onChange={(e) => setArvan({ ...arvan, endpoint: e.target.value })}
            onBlur={() => void saveArvan({ endpoint: arvan.endpoint })}
            placeholder="https://s3.ir-thr-at1.arvanstorage.ir"
          />
        </label>
        <label className="field">
          <span>Region</span>
          <input
            dir="ltr"
            value={arvan.region}
            onChange={(e) => setArvan({ ...arvan, region: e.target.value })}
            onBlur={() => void saveArvan({ region: arvan.region })}
            placeholder="ir-thr-at1"
          />
        </label>
        <label className="field">
          <span>Bucket</span>
          <input
            dir="ltr"
            value={arvan.bucket}
            onChange={(e) => setArvan({ ...arvan, bucket: e.target.value })}
            onBlur={() => void saveArvan({ bucket: arvan.bucket })}
          />
        </label>
        <label className="field">
          <span>مسیر فایل (object key)</span>
          <input
            dir="ltr"
            value={arvan.objectKey}
            onChange={(e) => setArvan({ ...arvan, objectKey: e.target.value })}
            onBlur={() => void saveArvan({ objectKey: arvan.objectKey })}
            placeholder="bahesab/ledger.json"
          />
        </label>
        <label className="field">
          <span>Access Key</span>
          <input
            dir="ltr"
            autoComplete="off"
            value={arvan.accessKeyId}
            onChange={(e) => setArvan({ ...arvan, accessKeyId: e.target.value })}
            onBlur={() => void saveArvan({ accessKeyId: arvan.accessKeyId })}
          />
        </label>
        <label className="field">
          <span>Secret Key</span>
          <input
            dir="ltr"
            type="password"
            autoComplete="off"
            value={arvan.secretAccessKey}
            onChange={(e) => setArvan({ ...arvan, secretAccessKey: e.target.value })}
            onBlur={() => void saveArvan({ secretAccessKey: arvan.secretAccessKey })}
          />
        </label>
        <p className="muted">
          روی باکت CORS را برای origin همین اپ با متدهای GET و PUT و هدرهای Authorization / Content-Type فعال
          کنید (مثلاً http://127.0.0.1:5173 و https://mhbesharatnia.github.io).
        </p>
        <div className="row">
          <button
            type="button"
            disabled={syncBusy || !arvan.enabled}
            onClick={() => {
              setSyncBusy(true)
              setError(null)
              void runArvanSync()
                .then((r) => {
                  if (r.ok) setMessage(r.message)
                  else setError(r.error)
                  return reload()
                })
                .finally(() => setSyncBusy(false))
            }}
          >
            {syncBusy ? 'در حال همگام‌سازی…' : 'همگام‌سازی الآن'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              const doc: ArvanConnectionExport = {
                schemaVersion: 1,
                app: 'bahesab-arvan',
                endpoint: arvan.endpoint,
                region: arvan.region,
                bucket: arvan.bucket,
                objectKey: arvan.objectKey,
                accessKeyId: arvan.accessKeyId,
                secretAccessKey: arvan.secretAccessKey,
              }
              const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'bahesab-arvan-connection.json'
              a.click()
              URL.revokeObjectURL(url)
              setMessage('فایل اتصال آروان ذخیره شد — روی دستگاه دیگر Import کنید')
            }}
          >
            Export اتصال آروان
          </button>
          <button type="button" className="ghost" onClick={() => arvanFileRef.current?.click()}>
            Import اتصال آروان
          </button>
          <input
            ref={arvanFileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => {
                try {
                  const doc = JSON.parse(String(reader.result)) as ArvanConnectionExport
                  if (doc.app !== 'bahesab-arvan' || doc.schemaVersion !== 1) {
                    setError('فایل اتصال آروان نامعتبر است')
                    return
                  }
                  void applyArvanConnectionImport({
                    endpoint: doc.endpoint,
                    region: doc.region,
                    bucket: doc.bucket,
                    objectKey: doc.objectKey,
                    accessKeyId: doc.accessKeyId,
                    secretAccessKey: doc.secretAccessKey,
                  })
                    .then(() => runArvanSync())
                    .then((r) => {
                      if (r.ok) {
                        setMessage(
                          r.action === 'pulled'
                            ? 'اتصال وارد شد و داده از آروان دریافت شد'
                            : `اتصال وارد شد — ${r.message}`,
                        )
                      } else {
                        setError(r.error)
                        setMessage('اتصال ذخیره شد؛ همگام‌سازی ناموفق بود — دوباره «همگام‌سازی الآن» را بزنید')
                      }
                      return reload()
                    })
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : 'خطا در وارد کردن اتصال'),
                    )
                } catch {
                  setError('فایل JSON نامعتبر است')
                }
              }
              reader.readAsText(file)
              e.target.value = ''
            }}
          />
        </div>
        {arvan.lastSyncAt && (
          <p className="muted">آخرین همگام‌سازی: {new Date(arvan.lastSyncAt).toLocaleString('fa-IR')}</p>
        )}
        {arvan.lastSyncError && <p className="error">خطای قبلی: {arvan.lastSyncError}</p>}
        {arvan.dirty && <p className="forecast">تغییرات محلی در صف ارسال به آروان است.</p>}
      </div>

      <h3>پشتیبان‌گیری محلی</h3>
      <div className="row">
        <button
          type="button"
          onClick={() =>
            void exportBackup().then((doc) => {
              const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `bahesab-backup-${doc.exportedAt.slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
              setMessage('خروجی گرفته شد')
            })
          }
        >
          Export
        </button>
        <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
          Import (جایگزینی کامل)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (!confirm('همهٔ داده‌های فعلی جایگزین می‌شود. ادامه می‌دهید؟')) return
            const reader = new FileReader()
            reader.onload = () => {
              try {
                const doc = JSON.parse(String(reader.result))
                void importBackupReplace(doc).then((r) => {
                  if (r.ok) {
                    setMessage('وارد شد')
                    setError(null)
                    void reload()
                  } else {
                    setError(r.errorFa)
                  }
                })
              } catch {
                setError('فایل JSON نامعتبر است')
              }
            }
            reader.readAsText(file)
            e.target.value = ''
          }}
        />
      </div>
      {message && <p className="ok">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
