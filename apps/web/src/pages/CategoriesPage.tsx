import { useEffect, useState } from 'react'
import { createCategory, deleteCategory, listCategories, updateCategory } from '../domain/categories'
import type { Category, CategoryKind } from '../lib/types'

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setItems(await listCategories())
  }

  useEffect(() => {
    void reload()
  }, [])

  function resetForm() {
    setEditId(null)
    setName('')
    setKind('expense')
  }

  return (
    <section>
      <div className="page-head">
        <h2>دسته‌ها</h2>
        <p className="sub">دسته‌بندی درآمد و هزینه</p>
      </div>
      <form
        className="card-form"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          const action = editId
            ? updateCategory(editId, { name, kind }).then(resetForm)
            : createCategory({ name, kind }).then(resetForm)
          void action
            .then(reload)
            .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
        }}
      >
        <h3>{editId ? 'ویرایش دسته' : 'دسته جدید'}</h3>
        <label className="field">
          <span>نام</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>نوع</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as CategoryKind)}>
            <option value="expense">هزینه</option>
            <option value="income">درآمد</option>
          </select>
        </label>
        <div className="row">
          <button type="submit">{editId ? 'ذخیره' : 'افزودن'}</button>
          {editId && (
            <button type="button" className="ghost" onClick={resetForm}>
              انصراف
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </form>
      <div className="card">
        <div className="card-head">
          <h3>فهرست دسته‌ها</h3>
        </div>
        <div className="card-body">
          <ul className="list" style={{ marginBottom: 0 }}>
            {items.map((c) => (
              <li key={c.id}>
                <span>
                  {c.name} — {c.kind === 'income' ? 'درآمد' : 'هزینه'}
                </span>
                <div className="row">
                  <button
                    type="button"
                    className="ghost sm"
                    onClick={() => {
                      setEditId(c.id)
                      setName(c.name)
                      setKind(c.kind)
                    }}
                  >
                    ویرایش
                  </button>
                  <button
                    type="button"
                    className="danger sm"
                    onClick={() =>
                      void deleteCategory(c.id)
                        .then(reload)
                        .catch((err) => setError(err instanceof Error ? err.message : 'خطا'))
                    }
                  >
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
