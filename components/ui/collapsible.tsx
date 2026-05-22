"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface CollapsibleProps {
  children: React.ReactNode
  className?: string
}

interface CollapsibleContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue>({
  open: false,
  setOpen: () => {},
})

const Collapsible = ({ children, className }: CollapsibleProps) => {
  const [open, setOpen] = React.useState(false)
  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ children, onClick, asChild, ...props }, ref) => {
  const { open, setOpen } = React.useContext(CollapsibleContext)

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        setOpen(!open)
        onClick?.(e as React.MouseEvent<HTMLButtonElement>)
        ;(children as React.ReactElement<any>).props.onClick?.(e)
      },
    })
  }

  return (
    <button
      ref={ref}
      onClick={(e) => {
        setOpen(!open)
        onClick?.(e)
      }}
      {...props}
    >
      {children}
    </button>
  )
})
CollapsibleTrigger.displayName = "CollapsibleTrigger"

const CollapsibleContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const { open } = React.useContext(CollapsibleContext)
  if (!open) return null
  return <div className={className}>{children}</div>
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
