"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"

interface FileUploaderProps {
  onUploadSuccess?: (publicUrl: string) => void
  onUploadError?: (error: string) => void
  maxSizeMB?: number
  accept?: string
}

export function FileUploader({ 
  onUploadSuccess, 
  onUploadError, 
  maxSizeMB = 5,
  accept = "image/jpeg, image/png, image/webp, image/gif" 
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true)
    else if (e.type === "dragleave") setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = async (file: File) => {
    // 1. Client-side Validation
    if (file.size > maxSizeMB * 1024 * 1024) {
      const err = `File size exceeds ${maxSizeMB}MB`
      onUploadError?.(err)
      return
    }
    
    // Set preview if image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => setPreview(reader.result as string)
      reader.readAsDataURL(file)
    }

    setUploading(true)
    setProgress(10)

    try {
      // 2. Get Presigned URL
      const res = await fetch('/api/upload/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size
        })
      })

      if (!res.ok) throw new Error(await res.text())
      
      const { uploadUrl, publicUrl } = await res.json()
      setProgress(40)

      const xhr = new XMLHttpRequest()
      
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded * 100) / event.total)
            setProgress(percentage)
          }
        }
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(true)
          } else {
            reject(new Error("Failed to upload to storage"))
          }
        }
        
        xhr.onerror = () => reject(new Error("Network error occurred during upload"))
      })

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)

      await uploadPromise

      onUploadSuccess?.(publicUrl)
      
    } catch (error: any) {
      console.error("Upload error:", error)
      onUploadError?.(error.message || "An error occurred during upload")
      setPreview(null)
    } finally {
      setTimeout(() => {
        setUploading(false)
        setProgress(0)
      }, 500)
    }
  }

  return (
    <div className="w-full">
      <div 
        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer overflow-hidden
          ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/10'}
          ${uploading ? 'pointer-events-none' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          className="hidden" 
          accept={accept}
          onChange={handleChange}
          disabled={uploading}
        />

        {preview && !uploading ? (
          <div className="absolute inset-0 w-full h-full p-2 bg-background flex items-center justify-center">
             <img src={preview} alt="Preview" className="max-h-full max-w-full rounded object-contain shadow-sm" />
             <div className="absolute top-4 right-4 flex gap-2">
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setPreview(null); }}>
                  Remove
                </Button>
             </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
              <span className="text-2xl">📁</span>
            </div>
            <div>
              <p className="font-bold text-lg">Click or drag file to this area to upload</p>
              <p className="text-sm text-muted-foreground mt-1">Support for a single file upload. Strictly prohibit from uploading company data or other band files</p>
            </div>
          </div>
        )}

        {/* Upload Overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-4">
            <p className="font-medium">Uploading... {progress}%</p>
            <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">Max file size: {maxSizeMB}MB</p>
    </div>
  )
}
