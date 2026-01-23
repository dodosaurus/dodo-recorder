import { useEffect, useState, useCallback } from 'react'
import { useRecordingStore } from '@/stores/recordingStore'

interface UserPreferences {
  startUrl?: string
  outputPath?: string
}

interface MicrophoneSettings {
  selectedMicrophoneId?: string
}

interface SettingsState {
  preferences: UserPreferences | null
  microphoneSettings: MicrophoneSettings | null
  isLoading: boolean
  error: string | null
}

/**
 * Shared hook for loading and updating app settings
 * Reduces duplicate IPC calls and centralizes settings management
 */
export function useSettings() {
  const [state, setState] = useState<SettingsState>({
    preferences: null,
    microphoneSettings: null,
    isLoading: true,
    error: null,
  })

  const {
    setStartUrl,
    setOutputPath,
    setSelectedMicrophoneId,
  } = useRecordingStore()

  // Load all settings on mount
  const loadSettings = useCallback(async () => {
    if (!window.electronAPI) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Electron API not available',
      }))
      return
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      // Load user preferences
      const prefsResult = await window.electronAPI.getUserPreferences()
      const preferences = prefsResult.success && (prefsResult as any).preferences
        ? (prefsResult as any).preferences
        : null

      // Load microphone settings
      const micResult = await window.electronAPI.getMicrophoneSettings()
      const microphoneSettings = micResult.success && (micResult as any).settings
        ? (micResult as any).settings
        : null

      setState({
        preferences,
        microphoneSettings,
        isLoading: false,
        error: null,
      })

      // Update Zustand store
      if (preferences) {
        if (preferences.startUrl) setStartUrl(preferences.startUrl)
        if (preferences.outputPath) setOutputPath(preferences.outputPath)
      }
      if (microphoneSettings) {
        setSelectedMicrophoneId(microphoneSettings.selectedMicrophoneId)
      }
    } catch (error) {
      console.error('[useSettings] Failed to load settings:', error)
      setState({
        preferences: null,
        microphoneSettings: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load settings',
      })
    }
  }, [setStartUrl, setOutputPath, setSelectedMicrophoneId])

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Update user preferences
  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    if (!window.electronAPI) return false

    try {
      await window.electronAPI.updateUserPreferences(updates)
      setState(prev => ({
        ...prev,
        preferences: { ...prev.preferences, ...updates },
      }))

      // Update Zustand store
      if (updates.startUrl !== undefined) setStartUrl(updates.startUrl)
      if (updates.outputPath !== undefined) setOutputPath(updates.outputPath)

      return true
    } catch (error) {
      console.error('[useSettings] Failed to update preferences:', error)
      return false
    }
  }, [setStartUrl, setOutputPath])

  // Update microphone settings
  const updateMicrophoneSettings = useCallback(async (updates: Partial<MicrophoneSettings>) => {
    if (!window.electronAPI) return false

    try {
      await window.electronAPI.updateMicrophoneSettings(updates)
      setState(prev => ({
        ...prev,
        microphoneSettings: { ...prev.microphoneSettings, ...updates },
      }))

      // Update Zustand store
      if (updates.selectedMicrophoneId !== undefined) {
        setSelectedMicrophoneId(updates.selectedMicrophoneId)
      }

      return true
    } catch (error) {
      console.error('[useSettings] Failed to update microphone settings:', error)
      return false
    }
  }, [setSelectedMicrophoneId])

  return {
    preferences: state.preferences,
    microphoneSettings: state.microphoneSettings,
    isLoading: state.isLoading,
    error: state.error,
    updatePreferences,
    updateMicrophoneSettings,
    reload: loadSettings,
  }
}
