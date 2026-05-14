"use client"

import { useRef, useEffect, useCallback } from "react"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
  readOnly?: boolean
  className?: string
}

const FORMATS = [
  { command: "bold", label: "B", title: "Bold", style: "font-bold" },
  { command: "italic", label: "I", title: "Italic", style: "italic" },
  { command: "underline", label: "U", title: "Underline", style: "underline" },
  { command: "strikeThrough", label: "S̶", title: "Strikethrough", style: "line-through" },
]

const LISTS = [
  { command: "insertUnorderedList", label: "• List", title: "Bullet List" },
  { command: "insertOrderedList", label: "1. List", title: "Numbered List" },
]

const HEADINGS = ["H1", "H2", "H3"]

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  minHeight = 200,
  readOnly = false,
  className = "",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isComposing = useRef(false)

  // Sync initial value into editor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, []) // only on mount

  const exec = useCallback((command: string, arg?: string) => {
    document.execCommand(command, false, arg)
    editorRef.current?.focus()
    handleChange()
  }, [])

  const handleChange = useCallback(() => {
    if (!editorRef.current || isComposing.current) return
    onChange(editorRef.current.innerHTML)
  }, [onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault()
      exec("insertHTML", "&nbsp;&nbsp;&nbsp;&nbsp;")
    }
    // Keyboard shortcuts
    if ((e.ctrlKey || e.metaKey)) {
      if (e.key === "b") { e.preventDefault(); exec("bold") }
      if (e.key === "i") { e.preventDefault(); exec("italic") }
      if (e.key === "u") { e.preventDefault(); exec("underline") }
    }
  }

  const insertHeading = (tag: string) => {
    exec("formatBlock", tag.toLowerCase())
  }

  const insertLink = () => {
    const url = prompt("Enter URL:")
    if (url) exec("createLink", url)
  }

  return (
    <div className={`border rounded-xl overflow-hidden bg-background ${className}`}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
          {FORMATS.map((f) => (
            <button
              key={f.command}
              onMouseDown={(e) => { e.preventDefault(); exec(f.command) }}
              title={f.title}
              className={`px-2.5 py-1.5 rounded text-sm hover:bg-background hover:shadow-sm transition-all ${f.style}`}
            >
              {f.label}
            </button>
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          {LISTS.map((l) => (
            <button
              key={l.command}
              onMouseDown={(e) => { e.preventDefault(); exec(l.command) }}
              title={l.title}
              className="px-2.5 py-1.5 rounded text-xs hover:bg-background hover:shadow-sm transition-all"
            >
              {l.label}
            </button>
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          {HEADINGS.map((h) => (
            <button
              key={h}
              onMouseDown={(e) => { e.preventDefault(); insertHeading(h) }}
              title={`Insert ${h}`}
              className="px-2 py-1.5 rounded text-xs font-bold hover:bg-background hover:shadow-sm transition-all"
            >
              {h}
            </button>
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          <button
            onMouseDown={(e) => { e.preventDefault(); insertLink() }}
            title="Insert link"
            className="px-2.5 py-1.5 rounded text-xs hover:bg-background hover:shadow-sm transition-all"
          >
            🔗
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); exec("removeFormat") }}
            title="Clear formatting"
            className="px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:bg-background hover:shadow-sm transition-all"
          >
            T×
          </button>
        </div>
      )}

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { isComposing.current = true }}
        onCompositionEnd={() => { isComposing.current = false; handleChange() }}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className={`px-4 py-3 text-sm focus:outline-none prose prose-sm max-w-none
          [&[data-placeholder]:empty:before]:content-[attr(data-placeholder)]
          [&[data-placeholder]:empty:before]:text-muted-foreground
          [&[data-placeholder]:empty:before]:pointer-events-none
          ${readOnly ? "cursor-default" : ""}
        `}
      />
    </div>
  )
}
