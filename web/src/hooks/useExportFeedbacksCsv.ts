import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportFeedbacksCsv } from '../services/adminService'

export function useExportFeedbacksCsv() {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)

  const exportCsv = useCallback(async (): Promise<string | null> => {
    setExporting(true)
    try {
      const csv = await exportFeedbacksCsv()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cfrm-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      return null
    } catch (e: unknown) {
      return e instanceof Error ? e.message : t('dashboard.exportFail')
    } finally {
      setExporting(false)
    }
  }, [t])

  return { exporting, exportCsv }
}
