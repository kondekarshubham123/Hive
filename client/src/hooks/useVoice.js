import { useState, useRef, useCallback } from 'react'
import { transcribeVoice } from '../api'

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = useCallback(async () => {
    setError(null)

    if (typeof window === 'undefined' || !window.MediaRecorder) {
      setError('MediaRecorder is not supported in this browser.')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'Microphone access requires a secure connection. ' +
        'Open the app via HTTPS, or use it directly on the Pi (localhost).'
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : {}
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(100)
      setIsRecording(true)
    } catch (err) {
      setError(err.message ?? 'Failed to access microphone.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    return new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('No active recorder'))
        return
      }

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []

        recorder.stream.getTracks().forEach((track) => track.stop())
        mediaRecorderRef.current = null
        setIsRecording(false)

        try {
          const result = await transcribeVoice(blob)
          resolve(result.text ?? result.transcript ?? '')
        } catch (err) {
          setError(err.message)
          reject(err)
        }
      }

      recorder.stop()
    })
  }, [])

  return { isRecording, startRecording, stopRecording, error }
}
