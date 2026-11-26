import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export default function EditorPanel({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
    const ref = useRef<HTMLDialogElement>(null)
    const { t } = useTranslation()
    useEffect(() => {
        const dialog = ref.current
        if (!dialog) return
        if (open && !dialog.open) dialog.showModal()
        if (!open && dialog.open) dialog.close()
    }, [open])
    // iOS keyboard shrinks the visual viewport, not always CSS viewport units.
    useEffect(() => {
        const viewport = window.visualViewport
        const update = () => {
            ref.current?.style.setProperty('--keyboard-height', `${viewport?.height ?? window.innerHeight}px`)
            ref.current?.style.setProperty('--keyboard-top', `${viewport?.offsetTop ?? 0}px`)
        }
        update()
        viewport?.addEventListener('resize', update)
        viewport?.addEventListener('scroll', update)
        return () => { viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update) }
    }, [])
    return <dialog ref={ref} className="editor-panel" aria-labelledby="editor-title" onCancel={event => { event.preventDefault(); onClose() }}>
        <header className="editor-header"><h2 id="editor-title">{title}</h2><button type="button" onClick={onClose} aria-label={t('Zur Karte, Eingaben behalten')}>✕</button></header>
        <div className="editor-scroll">{children}</div>
    </dialog>
}
