'use client'

import { useEffect, useRef, useState } from 'react'
import Header from './Header'

interface Props {
  children: React.ReactNode
}

const MOBILE_SHEET_SNAP_THRESHOLD = 36

export default function Sidebar({ children }: Props) {
  const [sheetOffset, setSheetOffset] = useState(0)
  const [maxOffset, setMaxOffset] = useState(180)
  const [isMobile, setIsMobile] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const asideRef = useRef<HTMLElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const dragStartY = useRef<number | null>(null)
  const dragStartOffset = useRef(0)
  const dragDelta = useRef(0)
  const hasMobileInit = useRef(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => {
      const mobile = media.matches
      setIsMobile(mobile)
      if (!mobile) {
        setSheetOffset(0)
        hasMobileInit.current = false
        document.documentElement.removeAttribute('data-mobile-sheet')
      }
    }

    sync()
    media.addEventListener('change', sync)
    return () => {
      media.removeEventListener('change', sync)
      document.documentElement.removeAttribute('data-mobile-sheet')
    }
  }, [])

  useEffect(() => {
    if (!isMobile) {
      document.documentElement.removeAttribute('data-mobile-sheet')
      return
    }

    document.documentElement.setAttribute(
      'data-mobile-sheet',
      sheetOffset >= maxOffset - 24 ? 'collapsed' : 'expanded',
    )
  }, [isMobile, maxOffset, sheetOffset])

  useEffect(() => {
    if (!isMobile) return

    const syncOffsets = () => {
      const asideHeight = asideRef.current?.offsetHeight ?? 0
      const handleHeight = headerRef.current?.querySelector<HTMLElement>('.mobile-sheet-handle')?.offsetHeight ?? 0
      const topbarHeight = headerRef.current?.querySelector<HTMLElement>('.header-topbar')?.offsetHeight ?? 0
      const visibleHeaderHeight = handleHeight + topbarHeight
      if (!asideHeight || !visibleHeaderHeight) return

      const nextMaxOffset = Math.max(0, asideHeight - visibleHeaderHeight)
      setMaxOffset(nextMaxOffset)

      setSheetOffset((current) => {
        if (!hasMobileInit.current) {
          hasMobileInit.current = true
          return Math.round(nextMaxOffset / 2)
        }

        return Math.min(current, nextMaxOffset)
      })
    }

    syncOffsets()

    const resizeObserver = new ResizeObserver(syncOffsets)
    if (asideRef.current) resizeObserver.observe(asideRef.current)
    if (headerRef.current) resizeObserver.observe(headerRef.current)

    window.addEventListener('resize', syncOffsets)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', syncOffsets)
    }
  }, [isMobile])

  function clampOffset(value: number) {
    return Math.max(0, Math.min(maxOffset, value))
  }

  function startDrag(clientY: number) {
    if (!isMobile) return
    setIsDragging(true)
    dragStartY.current = clientY
    dragStartOffset.current = sheetOffset
    dragDelta.current = 0
  }

  function moveDrag(clientY: number) {
    if (!isMobile || dragStartY.current == null) return
    const delta = clientY - dragStartY.current
    dragDelta.current = delta
    setSheetOffset(clampOffset(dragStartOffset.current + delta))
  }

  function endDrag() {
    if (!isMobile || dragStartY.current == null) return
    let nextOffset = sheetOffset > maxOffset / 2
      ? maxOffset
      : 0

    if (dragDelta.current > MOBILE_SHEET_SNAP_THRESHOLD) {
      nextOffset = maxOffset
    } else if (dragDelta.current < -MOBILE_SHEET_SNAP_THRESHOLD) {
      nextOffset = 0
    }

    setSheetOffset(nextOffset)
    dragStartY.current = null
    dragDelta.current = 0
    setIsDragging(false)
  }

  return (
    <aside
      ref={asideRef}
      className="sidebar-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        zIndex: 10,
        overflowY: 'hidden',
        transform: isMobile ? `translateY(${sheetOffset}px)` : undefined,
        transition: isDragging ? 'none' : 'transform 0.22s ease',
      }}
    >
      <div ref={headerRef} className="sidebar-header">
        <div
          className="mobile-sheet-handle"
          aria-hidden="true"
          onMouseDown={(e) => startDrag(e.clientY)}
          onMouseMove={(e) => moveDrag(e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={(e) => startDrag(e.touches[0].clientY)}
          onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
          onTouchEnd={endDrag}
          style={{
            display: 'none',
            justifyContent: 'center',
            paddingTop: 8,
            paddingBottom: 2,
            background: 'var(--bg-surface)',
            touchAction: 'none',
            cursor: isMobile ? 'grab' : 'default',
          }}
        >
          <span
            style={{
              width: 42,
              height: 5,
              borderRadius: 999,
              background: 'var(--border)',
              display: 'block',
            }}
          />
        </div>
        <Header />
      </div>
      <div
        className="mobile-panel-pad"
        style={{
          overflowY: 'auto',
          flexGrow: 1,
          minHeight: 0,
          padding: 20,
          background: 'var(--bg-base)',
        }}
      >
        {children}
      </div>
    </aside>
  )
}
