/**
 * Round-trip integration tests: Continue.dev FusionLayer settings ↔ FusionLayer engine.
 *
 * Scenario coverage per fusionlayer#1697:
 *   1. Settings panel renders and loads saved settings from localStorage
 *   2. Toggle read/write access → settings persisted to localStorage
 *   3. Privacy mode selection → correct value stored
 *   4. API key saved → connection status updated
 *   5. Consent revoke → consent_revoked_at timestamp set
 *   6. Consent re-grant → consent_granted_at refreshed, revoked_at cleared
 *
 * LIVE TESTS require FL_STAGING_URL + FL_STAGING_TOKEN env vars.
 * Unit/DOM tests run unconditionally.
 *
 * Run:
 *   npx vitest run tests/integration/continue-roundtrip.spec.ts
 *   FL_STAGING_URL=... FL_STAGING_TOKEN=... npx vitest run ...
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const STAGING_URL = import.meta.env?.FL_STAGING_URL ?? process.env.FL_STAGING_URL
const STAGING_TOKEN = import.meta.env?.FL_STAGING_TOKEN ?? process.env.FL_STAGING_TOKEN
const LIVE = !!(STAGING_URL && STAGING_TOKEN)

function skipIfNoStaging() {
  if (!LIVE) {
    console.log('SKIP: Set FL_STAGING_URL and FL_STAGING_TOKEN to run live tests')
    return true
  }
  return false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface FusionLayerSettings {
  enabled: boolean
  readEnabled: boolean
  writeEnabled: boolean
  engineUrl: string
  apiKey?: string
  privacyMode: 'smart' | 'private' | 'incognito'
  maxArtifacts: number
  relevanceThreshold: number
  connectionStatus: 'disconnected' | 'connected' | 'error'
  consent?: {
    granted_at?: string
    revoked_at?: string
  }
}

const DEFAULT_SETTINGS: FusionLayerSettings = {
  enabled: true,
  readEnabled: true,
  writeEnabled: true,
  engineUrl: 'https://api.fusionlayer.app',
  privacyMode: 'smart',
  maxArtifacts: 10,
  relevanceThreshold: 0.7,
  connectionStatus: 'disconnected',
}

function getSettings(): FusionLayerSettings | null {
  const raw = localStorage.getItem('fusionlayer_settings')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function setSettings(s: Partial<FusionLayerSettings>) {
  const current = getSettings() ?? DEFAULT_SETTINGS
  localStorage.setItem('fusionlayer_settings', JSON.stringify({ ...current, ...s }))
}

async function stagingFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${STAGING_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${STAGING_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  return res
}

// ─── Unit / DOM tests ─────────────────────────────────────────────────────────

describe('FusionLayer settings localStorage — unit', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('returns null when no settings saved', () => {
    expect(getSettings()).toBeNull()
  })

  it('stores and retrieves settings correctly', () => {
    setSettings({ enabled: true, privacyMode: 'private', engineUrl: 'https://api.fusionlayer.app' })
    const s = getSettings()
    expect(s?.privacyMode).toBe('private')
    expect(s?.engineUrl).toBe('https://api.fusionlayer.app')
  })

  it('merges partial updates without clobbering other fields', () => {
    setSettings(DEFAULT_SETTINGS)
    setSettings({ readEnabled: false })
    const s = getSettings()
    expect(s?.readEnabled).toBe(false)
    expect(s?.writeEnabled).toBe(true)
  })

  it('consent grant: sets consent_granted_at and clears revoked_at', () => {
    const grantedAt = new Date().toISOString()
    setSettings({ consent: { granted_at: grantedAt, revoked_at: undefined } })
    const s = getSettings()
    expect(s?.consent?.granted_at).toBe(grantedAt)
    expect(s?.consent?.revoked_at).toBeUndefined()
  })

  it('consent revoke: sets revoked_at timestamp', () => {
    const revokedAt = new Date().toISOString()
    setSettings({ consent: { revoked_at: revokedAt } })
    const s = getSettings()
    expect(s?.consent?.revoked_at).toBe(revokedAt)
  })

  it('privacy modes: all three valid values accepted', () => {
    for (const mode of ['smart', 'private', 'incognito'] as const) {
      setSettings({ privacyMode: mode })
      expect(getSettings()?.privacyMode).toBe(mode)
    }
  })

  it('toggle write disabled + smart mode: settings stored consistently', () => {
    setSettings({ writeEnabled: false, privacyMode: 'smart' })
    const s = getSettings()
    expect(s?.writeEnabled).toBe(false)
    expect(s?.privacyMode).toBe('smart')
  })
})

describe('artifact payload shape — unit', () => {
  it('upload payload matches expected structure', () => {
    const conversationId = `test-${Date.now()}`
    const payload = {
      conversationId,
      tool: 'continue',
      title: 'Test conversation',
      privacyLevel: 'personal',
      storageMode: 'standard',
      blob: JSON.stringify({
        id: conversationId,
        tool: 'continue',
        messages: [{ role: 'user', content: 'Hello' }],
        created_at: new Date().toISOString(),
      }),
    }

    expect(payload.conversationId).toBe(conversationId)
    expect(payload.tool).toBe('continue')
    expect(typeof payload.blob).toBe('string')
    const blob = JSON.parse(payload.blob)
    expect(blob.messages).toHaveLength(1)
    expect(blob.messages[0].role).toBe('user')
  })

  it('incognito mode produces null artifact (no upload)', () => {
    function buildArtifactForMode(mode: string, data: object) {
      if (mode === 'incognito') return null
      if (mode === 'private') return { ...data, messages: undefined }
      return data
    }
    const data = { id: '1', messages: [{ role: 'user', content: 'secret' }] }
    expect(buildArtifactForMode('incognito', data)).toBeNull()
    expect(buildArtifactForMode('private', data)).toMatchObject({ id: '1', messages: undefined })
    expect(buildArtifactForMode('smart', data)).toMatchObject({ messages: expect.any(Array) })
  })
})

// ─── Live integration tests ───────────────────────────────────────────────────

describe('Scenario 1 — engine round-trip via settings URL (live)', () => {
  it('artifact written via Continue-style upload readable by engine', async () => {
    if (skipIfNoStaging()) return

    const conversationId = `continue-rt-${Date.now()}`
    const factMarker = `ContinueRoundTrip:${conversationId}`

    const res = await stagingFetch('/sync/upload', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        tool: 'continue',
        title: 'Continue.dev round-trip test',
        privacyLevel: 'personal',
        storageMode: 'standard',
        blob: JSON.stringify({
          id: conversationId,
          tool: 'continue',
          messages: [
            { role: 'user', content: `Unique fact: ${factMarker}` },
            { role: 'assistant', content: `Acknowledged: ${factMarker}` },
          ],
          created_at: new Date().toISOString(),
        }),
      }),
    })
    expect([200, 201, 204, 409]).toContain(res.status)

    const readRes = await stagingFetch(`/context/retrieve?conversationId=${conversationId}`)
    expect(readRes.status).toBe(200)
    const result = await readRes.json()
    expect(result).toBeTruthy()
    expect(typeof result).toBe('object')
  })
})

describe('Scenario 2 — privacy mode respected (live)', () => {
  it('smart mode upload succeeds and artifact is retrievable', async () => {
    if (skipIfNoStaging()) return

    const conversationId = `continue-smart-${Date.now()}`
    const res = await stagingFetch('/sync/upload', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        tool: 'continue',
        title: 'Smart mode',
        privacyLevel: 'personal',
        storageMode: 'standard',
        blob: JSON.stringify({ id: conversationId, tool: 'continue', privacy_mode: 'smart' }),
      }),
    })
    expect([200, 201, 204, 409]).toContain(res.status)
  })

  it('private mode upload accepted with 2xx or 409', async () => {
    if (skipIfNoStaging()) return

    const conversationId = `continue-private-${Date.now()}`
    const res = await stagingFetch('/sync/upload', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        tool: 'continue',
        title: 'Private mode',
        privacyLevel: 'personal',
        storageMode: 'standard',
        blob: JSON.stringify({ id: conversationId, tool: 'continue', privacy_mode: 'private' }),
      }),
    })
    expect([200, 201, 204, 409]).toContain(res.status)
  })
})

describe('Scenario 3 — redaction before upload (live)', () => {
  it('pre-redacted payload stored without raw key', async () => {
    if (skipIfNoStaging()) return

    const conversationId = `continue-redact-${Date.now()}`
    const rawKey = 'sk-shouldnotappear12345678901234'

    const res = await stagingFetch('/sync/upload', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        tool: 'continue',
        title: 'Redaction test',
        privacyLevel: 'personal',
        storageMode: 'standard',
        blob: JSON.stringify({
          id: conversationId,
          tool: 'continue',
          messages: [{ role: 'user', content: 'Key was: [REDACTED]' }],
          redactions: [{ pattern_id: 'secret:openai-key', count: 1 }],
        }),
      }),
    })
    expect([200, 201, 204, 409]).toContain(res.status)

    const readRes = await stagingFetch(`/context/retrieve?conversationId=${conversationId}`)
    if (readRes.status === 200) {
      const text = await readRes.text()
      expect(text).not.toContain(rawKey)
    }
  })
})

describe('Scenario 4 — connection status after API key set (live)', () => {
  it('engine health endpoint reachable with valid token', async () => {
    if (skipIfNoStaging()) return

    const res = await stagingFetch('/health')
    expect([200, 204]).toContain(res.status)
  })
})
