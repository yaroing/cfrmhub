import { useRef, useState } from 'react'
import clsx from 'clsx'
import { Button } from './Button'

type Props = {
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxSizeMb?: number
  onChange: (files: File[]) => void
  className?: string
}

export function FileUpload({
  accept = 'image/*,application/pdf,audio/*',
  multiple = true,
  maxFiles = 3,
  maxSizeMb = 10,
  onChange,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<{ file: File; url?: string }[]>([])

  function pick() {
    inputRef.current?.click()
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : []
    const maxBytes = maxSizeMb * 1024 * 1024
    const next: File[] = []
    for (const f of list) {
      if (f.size > maxBytes) continue
      next.push(f)
    }
    const merged = multiple ? [...previews.map((p) => p.file), ...next].slice(0, maxFiles) : next.slice(0, 1)
    const pv = merged.map((file) => {
      if (file.type.startsWith('image/')) {
        return { file, url: URL.createObjectURL(file) }
      }
      return { file }
    })
    setPreviews(pv)
    onChange(merged)
    e.target.value = ''
  }

  function removeAt(i: number) {
    const p = previews[i]
    if (p?.url) URL.revokeObjectURL(p.url)
    const merged = previews.filter((_, j) => j !== i)
    setPreviews(merged)
    onChange(merged.map((x) => x.file))
  }

  return (
    <div className={clsx('space-y-3', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={onInput}
      />
      <Button type="button" variant="secondary" size="sm" onClick={pick}>
        Ajouter des fichiers (max {maxFiles}, {maxSizeMb} Mo chacun)
      </Button>
      <ul className="flex flex-wrap gap-3">
        {previews.map((p, i) => (
          <li
            key={`${p.file.name}-${i}`}
            className="relative rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-2 text-xs"
          >
            {p.url && (
              <img src={p.url} alt="" className="mb-1 h-20 w-20 rounded object-cover" />
            )}
            <span className="block max-w-[140px] truncate">{p.file.name}</span>
            <button
              type="button"
              className="mt-1 text-red-500 hover:underline"
              onClick={() => removeAt(i)}
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
