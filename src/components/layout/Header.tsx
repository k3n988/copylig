/// <reference types="@types/google.maps" />
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useAuthStore } from '@/store/authStore'
import { useHouseholdStore } from '@/store/householdStore'
import AuthModal from '@/components/auth/AuthModal'
import ThemeToggle from './ThemeToggle'

const ADMIN_TABS = [
  { href: '/queue', label: 'QUEUE' },
  { href: '/assets', label: 'ASSETS' },
  { href: '/register', label: 'REGISTRATION' },
  { href: '/admin', label: 'DASHBOARD' },
  
]

const RESCUER_TABS = [
  { href: '/queue', label: 'QUEUE' },
  { href: '/admin', label: 'DASHBOARD' },
]

const CITIZEN_TABS: { href: string; label: string }[] = []

interface Suggestion {
  place_id: string
  description: string
  main_text: string
  secondary_text: string
}

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, showModal, setShowModal } = useAuthStore()
  const setPanToCoords = useHouseholdStore((s) => s.setPanToCoords)

  const placesLib = useMapsLibrary('places')
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null)
  const geocoder = useRef<google.maps.Geocoder | null>(null)

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleQueryChange(nextQuery: string) {
    setQuery(nextQuery)
    if (nextQuery.trim().length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!placesLib) return
    autocompleteService.current = new placesLib.AutocompleteService()
    geocoder.current = new google.maps.Geocoder()
  }, [placesLib])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2 || !autocompleteService.current) return

    debounceRef.current = setTimeout(() => {
      setLoading(true)
      autocompleteService.current?.getPlacePredictions(
        { input: q, componentRestrictions: { country: 'ph' } },
        (
          predictions: google.maps.places.AutocompletePrediction[] | null,
          status: google.maps.places.PlacesServiceStatus,
        ) => {
          setLoading(false)
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            setSuggestions([])
            return
          }
          setSuggestions(
            predictions.map((p: google.maps.places.AutocompletePrediction) => ({
              place_id: p.place_id,
              description: p.description,
              main_text: p.structured_formatting.main_text,
              secondary_text: p.structured_formatting.secondary_text,
            })),
          )
          setShowDropdown(true)
        },
      )
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectSuggestion(s: Suggestion) {
    if (!geocoder.current) return
    geocoder.current.geocode(
      { placeId: s.place_id },
      (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          const loc = results[0].geometry.location
          setPanToCoords({ lat: loc.lat(), lng: loc.lng() })
        }
      },
    )
    setQuery('')
    setSuggestions([])
    setShowDropdown(false)
    inputRef.current?.blur()
  }

  function useCurrentLocation() {
    setShowDropdown(false)
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      setPanToCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, zoom: 17 })
    })
  }

  function clearQuery() {
    setQuery('')
    setSuggestions([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (suggestions.length > 0) selectSuggestion(suggestions[0])
  }

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  function getTabsForRole() {
    if (user?.role === 'admin') return ADMIN_TABS
    if (user?.role === 'rescuer') return RESCUER_TABS
    return CITIZEN_TABS
  }

  const tabs = getTabsForRole()
  const showSearchBar = pathname !== '/admin'

  return (
    <div style={{ flexShrink: 0 }}>
      <div
        className="header-topbar"
        style={{
          padding: '12px 14px',
          background: 'var(--topbar-bg)',
          borderBottom: '2px solid var(--critical-red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <Image
            src="/logo2.png"
            alt="LIGTAS Logo"
            width={42}
            height={42}
            priority
            style={{ objectFit: 'contain' }}
          />
          <div className="header-brand-copy" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 className="header-brand-title" style={{ margin: 0, fontSize: '1.12rem', color: 'var(--topbar-text)', letterSpacing: 1.6, lineHeight: 1.05 }}>
              L.I.G.T.A.S.
            </h1>
            <p className="header-brand-subtitle" style={{ margin: '2px 0 0', fontSize: '0.54rem', color: 'var(--topbar-muted-text)', letterSpacing: 0.28, lineHeight: 1.35 }}>
              Location Intelligence &amp; Geospatial Triage
              <br />
              for Accelerated Support
            </p>
          </div>
        </div>

        <div className="header-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <div className="header-controls-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', rowGap: 6 }}>
            <ThemeToggle />
            {user ? (
              <button
                onClick={handleLogout}
                style={{
                  padding: '6px 12px',
                  background: 'var(--topbar-control-bg)',
                  border: '1px solid var(--topbar-control-border)',
                  color: 'var(--topbar-text)',
                  borderRadius: 8,
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  letterSpacing: 1,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                LOG OUT
              </button>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                style={{
                  padding: '7px 12px',
                  background: '#0a67d0',
                  border: '1px solid #0a67d0',
                  color: '#fff',
                  borderRadius: 8,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: 1,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                LOG IN
              </button>
            )}
          </div>
          {user && (
            <span className="header-user-meta" style={{ fontSize: '0.62rem', color: 'var(--topbar-muted-text)', padding: '0 2px', textAlign: 'right', maxWidth: 180, overflowWrap: 'anywhere' }}>
              {user.contact}
            </span>
          )}
        </div>
      </div>

      {showSearchBar && (
      <div
        className="header-search-shell"
        style={{
          padding: '12px 14px',
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-color)',
          position: 'relative',
          zIndex: 200,
        }}
      >
        <form onSubmit={handleSubmit}>
          <div
            className="header-search-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--bg-surface)',
              borderRadius: showDropdown ? '10px 10px 0 0' : 10,
              padding: '10px 12px',
              border: '1px solid var(--border)',
              transition: 'border-radius 0.1s',
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>📍</span>
            <input
              ref={inputRef}
              type="text"
              aria-label="Search a place or barangay"
              placeholder="Search a place or barangay..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true)
              }}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.85rem',
                color: 'var(--fg-default)',
                minWidth: 0,
              }}
            />
            {query && (
              <button
                type="button"
                onClick={clearQuery}
                aria-label="Clear search"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--fg-subtle)',
                  cursor: 'pointer',
                  padding: '0 4px',
                  fontSize: '1rem',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
            <button
              type="submit"
              aria-label="Submit place search"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: loading ? 'var(--fg-subtle)' : 'var(--accent-blue)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '0.85rem',
              }}
            >
              {loading ? '…' : '🔍'}
            </button>
          </div>
        </form>

        {showDropdown && (
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              left: 14,
              right: 14,
              top: '100%',
              marginTop: -1,
              background: 'var(--bg-surface)',
              borderRadius: '0 0 10px 10px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              zIndex: 300,
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            <button
              onClick={useCurrentLocation}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '11px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '1rem', color: 'var(--accent-blue)' }}>🎯</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                Your Current Location
              </span>
            </button>

            {suggestions.map((s, i) => (
              <button
                key={s.place_id}
                onClick={() => selectSuggestion(s)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  width: '100%',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '0.85rem', marginTop: 1, flexShrink: 0 }}>📍</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg-default)', lineHeight: 1.3 }}>
                    {s.main_text}
                  </div>
                  {s.secondary_text && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginTop: 1 }}>
                      {s.secondary_text}
                    </div>
                  )}
                </div>
              </button>
            ))}

            {suggestions.length === 0 && !loading && (
              <div style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--fg-subtle)' }}>
                No results found.
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {user && tabs.length > 0 && (
        <div
          className="header-tabs-bar hide-scrollbar"
          style={{
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'hidden',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-dark)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {tabs.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                style={{
                  flexShrink: 0,
                  padding: '14px 16px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
                  background: active ? 'var(--panel-bg)' : 'transparent',
                  transition: 'color 0.15s, background 0.15s',
                }}
              >
                {label}
              </Link>
            )
          })}
        </div>
      )}

      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
