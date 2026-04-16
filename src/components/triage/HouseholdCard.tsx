'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Household } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { useHouseholdStore } from '@/store/householdStore'
import { useAssetStore } from '@/store/assetStore'
import { useHazardStore } from '@/store/hazardStore'
import { buildAssetRecommendation, type AssetRecommendationResult } from '@/lib/ai/advisories'
import TriageBadge from './TriageBadge'

interface Props {
  household: Household
}

const BORDER_COLOR: Record<string, string> = {
  red: 'var(--critical-red)',
  orange: 'var(--high-orange)',
  yellow: 'var(--elevated-yellow)',
  blue: 'var(--accent-blue)',
}

const btnBase: React.CSSProperties = {
  flex: 1,
  padding: '8px',
  fontSize: '0.75rem',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 600,
  textTransform: 'uppercase',
}

export default function HouseholdCard({ household: hh }: Props) {
  const user = useAuthStore((s) => s.user)
  const markRescued = useHouseholdStore((s) => s.markRescued)
  const restorePending = useHouseholdStore((s) => s.restorePending)
  const setPanTo = useHouseholdStore((s) => s.setPanTo)
  const dispatchRescue = useHouseholdStore((s) => s.dispatchRescue)
  const assets = useAssetStore((s) => s.assets)
  const setAssetStatus = useAssetStore((s) => s.setAssetStatus)
  const activeHazard = useHazardStore((s) => s.activeHazard)
  const floodZones = useHazardStore((s) => s.floodZones)

  const [showPicker, setShowPicker] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState('')

  const isRescued = hh.status === 'Rescued'
  const isRescuer = user?.role === 'rescuer'
  const currentRescuerAsset = user?.assetId ? assets.find((a) => a.id === user.assetId) ?? null : null
  const isAssignedToCurrentRescuer = Boolean(user?.assetId && hh.assignedAssetId === user.assetId)
  const isAssignedToAnotherAsset = Boolean(hh.assignedAssetId && !isAssignedToCurrentRescuer)
  const borderColor = isRescued ? 'var(--resolved-green)' : BORDER_COLOR[hh.triage.colorName]
  const assignedAsset = hh.assignedAssetId ? assets.find((a) => a.id === hh.assignedAssetId) : null

  const ruleBasedRecommendation = useMemo(
    () =>
      buildAssetRecommendation({
        household: hh,
        assets,
        hazard: activeHazard,
        floodZones,
      }),
    [activeHazard, assets, floodZones, hh],
  )

  const [recommendation, setRecommendation] = useState<AssetRecommendationResult>(ruleBasedRecommendation)

  useEffect(() => {
    if (!showPicker) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/ai/asset-recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ household: hh, assets, hazard: activeHazard, floodZones }),
        })
        if (res.ok && !cancelled) {
          const data = (await res.json()) as AssetRecommendationResult
          setRecommendation(data)
        }
      } catch {
        // keep rule-based
      }
    })()
    return () => { cancelled = true }
  }, [showPicker, hh, assets, activeHazard, floodZones])

  const recommendedIds = new Set(recommendation.recommendedAssetIds)
  const blockedIds = new Set(recommendation.blockedAssetIds)

  const handleConfirmDispatch = () => {
    if (!selectedAssetId || blockedIds.has(selectedAssetId)) return
    void dispatchRescue(hh.id, selectedAssetId)
    void setAssetStatus(selectedAssetId, 'Dispatching')
    setShowPicker(false)
    setSelectedAssetId('')
  }

  const handleReassign = () => {
    setSelectedAssetId(hh.assignedAssetId ?? '')
    setShowPicker(true)
  }

  const handleRescuerRespond = () => {
    if (!user?.assetId || isAssignedToAnotherAsset) return
    void dispatchRescue(hh.id, user.assetId)
    void setAssetStatus(user.assetId, 'Dispatching')
  }

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 6,
        padding: 15,
        marginBottom: 10,
        opacity: isRescued ? 0.74 : 1,
      }}
    >
      <div
        className="mobile-stack"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 6,
          gap: 8,
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--fg-default)' }}>
          {hh.head}
        </h3>
        <TriageBadge triage={hh.triage} rescued={isRescued} />
      </div>

      <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {hh.street}, Brgy. {hh.barangay}, {hh.city} - {hh.occupants} occupants
      </p>
      {hh.source && (
        <p style={{ margin: '0 0 8px', fontSize: '0.68rem', color: 'var(--accent-blue)' }}>
          Source: {hh.source}
        </p>
      )}

      <div style={{ marginBottom: 10 }}>
        {hh.vulnArr.map((v) => (
          <span
            key={v}
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              background: 'var(--bg-elevated)',
              borderRadius: 4,
              fontSize: '0.7rem',
              marginRight: 4,
              marginBottom: 4,
              color: 'var(--text-main)',
            }}
          >
            {v}
          </span>
        ))}
      </div>

      {!isRescued && showPicker && !isRescuer && (
        <div
          style={{
            background: 'var(--bg-warning-subtle)',
            border: '1px solid var(--warning-border)',
            borderRadius: 8,
            padding: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--warning-strong)', textTransform: 'uppercase', letterSpacing: 1 }}>
              AI Dispatch Advisory
            </div>
            <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 999, fontWeight: 700,
              background: recommendation.source === 'gemini' ? 'var(--accent-blue)' : 'var(--bg-elevated)',
              color: recommendation.source === 'gemini' ? '#fff' : 'var(--fg-muted)',
            }}>
              {recommendation.source === 'gemini' ? 'AI' : 'Rule-based'}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-default)', fontWeight: 700, marginBottom: 4 }}>
            {recommendation.summary}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            {recommendation.rationale}
          </div>
        </div>
      )}

      {isRescued ? (
        <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <p style={{ margin: 0, color: 'var(--resolved-green)', fontWeight: 'bold', fontSize: '0.8rem' }}>
            Operation Complete
          </p>
          <button
            onClick={() => restorePending(hh.id)}
            title="Restore to pending"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--fg-muted)',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
              fontSize: '0.72rem',
            }}
          >
            Restore
          </button>
        </div>
      ) : (
        <>
          {assignedAsset && !showPicker && (
            <div
              className="mobile-stack"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '6px 10px',
                marginBottom: 10,
                fontSize: '0.75rem',
                gap: 8,
              }}
            >
              <span style={{ color: 'var(--high-orange)', fontWeight: 600 }}>
                {assignedAsset.icon} {assignedAsset.name} - dispatched
              </span>
              {!isRescuer && (
                <button
                  onClick={handleReassign}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--fg-muted)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                  }}
                >
                  Reassign
                </button>
              )}
            </div>
          )}

          {showPicker && !isRescuer && (
            <div
              style={{
                background: 'var(--bg-inset)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '10px',
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                Select Rescue Asset
              </div>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg-default)',
                  borderRadius: 4,
                  padding: '6px 8px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                <option value="" disabled>
                  Choose asset...
                </option>
                {assets.map((a) => {
                  const isRecommended = recommendedIds.has(a.id)
                  const isBlocked = blockedIds.has(a.id)
                  const badge = isBlocked ? ' [LOCKED]' : isRecommended ? ' [RECOMMENDED]' : ''
                  return (
                    <option key={a.id} value={a.id} disabled={isBlocked}>
                      {a.icon} {a.name} ({a.status}){badge}
                    </option>
                  )
                })}
              </select>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowPicker(false)
                    setSelectedAssetId('')
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--fg-muted)',
                    borderRadius: 4,
                    padding: '6px 14px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDispatch}
                  disabled={!selectedAssetId || blockedIds.has(selectedAssetId)}
                  style={{
                    background: selectedAssetId && !blockedIds.has(selectedAssetId) ? 'var(--resolved-green)' : 'var(--bg-elevated)',
                    color: selectedAssetId && !blockedIds.has(selectedAssetId) ? '#fff' : 'var(--fg-subtle)',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 16px',
                    cursor: selectedAssetId && !blockedIds.has(selectedAssetId) ? 'pointer' : 'default',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  Confirm
                </button>
              </div>
              {recommendation.recommendedAssetIds.length > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--resolved-green)' }}>
                  Recommended first: {assets.filter((asset) => recommendedIds.has(asset.id)).map((asset) => asset.name).join(', ')}
                </div>
              )}
            </div>
          )}

          <div className="mobile-stack" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isRescuer ? (
              <button
                onClick={handleRescuerRespond}
                disabled={!currentRescuerAsset || isAssignedToAnotherAsset}
                style={{
                  ...btnBase,
                  background: !currentRescuerAsset || isAssignedToAnotherAsset
                    ? 'var(--bg-elevated)'
                    : isAssignedToCurrentRescuer
                      ? 'var(--warning-strong)'
                      : 'var(--critical-red)',
                  color: !currentRescuerAsset || isAssignedToAnotherAsset ? 'var(--fg-subtle)' : '#fff',
                  border: 'none',
                  cursor: !currentRescuerAsset || isAssignedToAnotherAsset ? 'default' : 'pointer',
                }}
              >
                {isAssignedToCurrentRescuer ? 'En Route' : isAssignedToAnotherAsset ? 'Assigned Elsewhere' : 'Respond'}
              </button>
            ) : (
              !assignedAsset && !showPicker && (
                <button
                  onClick={() => setShowPicker(true)}
                  style={{
                    ...btnBase,
                    background: 'var(--critical-red)',
                    color: '#fff',
                    border: 'none',
                  }}
                >
                  Dispatch Rescue
                </button>
              )
            )}
            <button
              onClick={() => setPanTo(hh.id)}
              style={{
                ...btnBase,
                background: 'var(--bg-elevated)',
                color: 'var(--fg-default)',
                border: 'none',
                flex: assignedAsset ? 1 : '0 1 auto',
              }}
            >
              Locate
            </button>
            <button
              onClick={() => markRescued(hh.id)}
              style={{
                ...btnBase,
                background: 'transparent',
                border: '1px solid var(--resolved-green)',
                color: 'var(--resolved-green)',
                flex: assignedAsset ? 1 : '0 1 auto',
              }}
            >
              {isRescuer ? 'Complete Rescue' : 'Mark Rescued'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
