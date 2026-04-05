import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { adminUpsertCategory, fetchAllCategories } from '../../services/adminService'
import type { Category } from '../../types'

export function AdminCategoriesPage() {
  const [rows, setRows] = useState<Category[]>([])
  const [err, setErr] = useState('')
  const [slug, setSlug] = useState('')
  const [label, setLabel] = useState('')
  const [order, setOrder] = useState('100')

  const load = useCallback(async () => {
    try {
      const data = await fetchAllCategories()
      setRows(data as Category[])
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement liste au montage
    void load()
  }, [load])

  async function add() {
    if (!slug.trim() || !label.trim()) return
    try {
      await adminUpsertCategory({
        slug: slug.trim(),
        label_fr: label.trim(),
        sort_order: Number(order) || 0,
        is_active: true,
      })
      setSlug('')
      setLabel('')
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Création impossible')
    }
  }

  async function toggleActive(c: Category) {
    try {
      await adminUpsertCategory({
        id: c.id,
        slug: c.slug,
        label_fr: c.label_fr,
        sort_order: c.sort_order,
        is_active: !c.is_active,
      })
      await load()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur')
    }
  }

  return (
    <div className="flex-1 space-y-6 overflow-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--text-heading)]">Catégories</h1>
      {err && <p className="text-sm text-red-500">{err}</p>}

      <Card>
        <h2 className="mb-4 font-semibold">Ajouter une catégorie</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder="slug (ex: logistique)" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Input placeholder="Libellé FR" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input placeholder="Ordre" value={order} onChange={(e) => setOrder(e.target.value)} />
          <Button type="button" onClick={() => void add()}>
            Ajouter
          </Button>
        </div>
      </Card>

      <Card>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2">Slug</th>
              <th className="pb-2">Libellé</th>
              <th className="pb-2">Ordre</th>
              <th className="pb-2">Actif</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)]/60">
                <td className="py-2">{c.slug}</td>
                <td className="py-2">{c.label_fr}</td>
                <td className="py-2">{c.sort_order}</td>
                <td className="py-2">
                  <Button size="sm" variant="secondary" type="button" onClick={() => void toggleActive(c)}>
                    {c.is_active ? 'Désactiver' : 'Activer'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
