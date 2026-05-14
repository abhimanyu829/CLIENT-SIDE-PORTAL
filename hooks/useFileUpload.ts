"use client"

import { useState, useCallback, useRef } from "react"

export type UploadStatus = "idle" | "uploading" | "success" | "error"

export interface UploadedFile {
  key: string
  url: string
  name: string
  size: number
  type: string
}

export interface UseFileUploadOptions {
  maxSizeMB?: number
  allowedTypes?: string[]
  onSuccess?: (file: UploadedFile) => void
  onError?: (error: string) => void
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { maxSizeMB = 10, allowedTypes, onSuccess, onError } = options

  const [status, setStatus] = useState<UploadStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const validateFile = useCallback(
    (file: File): string | null => {
      const sizeMB = file.size / (1024 * 1024)
      if (sizeMB > maxSizeMB) return `File must be under ${maxSizeMB}MB`
      if (allowedTypes && !allowedTypes.includes(file.type))
        return `Allowed types: ${allowedTypes.join(", ")}`
      return null
    },
    [maxSizeMB, allowedTypes]
  )

  const upload = useCallback(
    async (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        onError?.(validationError)
        return null
      }

      setStatus("uploading")
      setProgress(0)
      setError(null)
      abortRef.current = new AbortController()

      try {
        // Step 1: Get pre-signed PUT URL from our API
        const signedRes = await fetch("/api/upload/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
          signal: abortRef.current.signal,
        })

        if (!signedRes.ok) throw new Error("Failed to get upload URL")
        const { uploadUrl, key, publicUrl } = await signedRes.json()

        // Step 2: PUT file directly to R2/S3
        setProgress(30)
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
          signal: abortRef.current.signal,
        })

        if (!uploadRes.ok) throw new Error("Upload to storage failed")
        setProgress(100)

        const result: UploadedFile = {
          key,
          url: publicUrl,
          name: file.name,
          size: file.size,
          type: file.type,
        }

        setUploadedFile(result)
        setStatus("success")
        onSuccess?.(result)
        return result
      } catch (err: any) {
        if (err.name === "AbortError") return null
        const msg = err.message ?? "Upload failed"
        setError(msg)
        setStatus("error")
        onError?.(msg)
        return null
      }
    },
    [validateFile, onSuccess, onError]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setStatus("idle")
    setProgress(0)
  }, [])

  const reset = useCallback(() => {
    setStatus("idle")
    setProgress(0)
    setUploadedFile(null)
    setError(null)
  }, [])

  return { upload, cancel, reset, status, progress, uploadedFile, error }
}
