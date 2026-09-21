import { db } from '../lib/db'
import { newId, nowISO } from '../lib/id'
import type { Category, CategoryKind } from '../lib/types'

export async function listCategories(includeArchived = false): Promise<Category[]> {
  const all = await db.categories.toArray()
  return all
    .filter((c) => (includeArchived || !c.archived) && c.systemKey !== 'opening')
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
}

export async function createCategory(input: { name: string; kind: CategoryKind }): Promise<Category> {
  const name = input.name.trim()
  if (!name) throw new Error('نام دسته الزامی است')
  const t = nowISO()
  const cat: Category = {
    id: newId(),
    name,
    kind: input.kind,
    systemKey: null,
    archived: false,
    createdAt: t,
    updatedAt: t,
  }
  await db.categories.add(cat)
  return cat
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'kind' | 'archived'>>,
): Promise<void> {
  const cat = await db.categories.get(id)
  if (!cat) throw new Error('دسته یافت نشد')
  if (cat.systemKey) throw new Error('دسته سیستمی قابل ویرایش نیست')
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('نام دسته الزامی است')
    patch.name = name
  }
  await db.categories.update(id, { ...patch, updatedAt: nowISO() })
}

export async function deleteCategory(id: string): Promise<void> {
  const cat = await db.categories.get(id)
  if (!cat) throw new Error('دسته یافت نشد')
  if (cat.systemKey) throw new Error('دسته سیستمی قابل حذف نیست')
  const txnCount = await db.transactions.where({ categoryId: id }).count()
  const schedCount = await db.scheduledItems.where({ categoryId: id }).count()
  if (txnCount > 0 || schedCount > 0) {
    throw new Error('حذف دسته دارای تراکنش یا تعهد/مطالبه مجاز نیست')
  }
  await db.categories.delete(id)
}
