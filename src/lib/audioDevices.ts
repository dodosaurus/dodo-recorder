/**
 * Audio device enumeration utilities
 * Handles enumeration of audio input devices and permission management
 */

/**
 * Represents an audio input device
 */
export interface AudioDevice {
  deviceId: string
  label: string
  groupId: string
}

/**
 * Request microphone permission before enumerating devices
 * This is required because device labels are hidden until permission is granted
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Stop the tracks immediately - we only needed permission
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch (error) {
    console.error('Failed to request microphone permission:', error)
    return false
  }
}

/**
 * Enumerate all available audio input devices
 * @returns Promise resolving to array of audio devices
 */
export async function enumerateAudioDevices(): Promise<AudioDevice[]> {
  try {
    // Request permission first to get device labels
    await requestMicrophonePermission()
    
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputDevices = devices
      .filter(device => device.kind === 'audioinput')
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId,
      }))
    
    console.log(`Found ${audioInputDevices.length} audio input devices`)
    audioInputDevices.forEach((device, index) => {
      console.log(`  [${index + 1}] ${device.label} (${device.deviceId})`)
    })
    
    return audioInputDevices
  } catch (error) {
    console.error('Failed to enumerate audio devices:', error)
    return []
  }
}

/**
 * Check if a specific device ID exists in the current device list
 * @param deviceId - The device ID to check
 * @returns Promise resolving to true if device exists, false otherwise
 */
export async function deviceExists(deviceId: string): Promise<boolean> {
  const devices = await enumerateAudioDevices()
  return devices.some(device => device.deviceId === deviceId)
}

/**
 * Get the default audio input device
 * @returns Promise resolving to the default device or null if not found
 */
export async function getDefaultAudioDevice(): Promise<AudioDevice | null> {
  const devices = await enumerateAudioDevices()
  // The first device is typically the default
  return devices.length > 0 ? devices[0] : null
}
