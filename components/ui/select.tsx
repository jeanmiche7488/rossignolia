"use client"

import * as React from "react"
import { cn } from "@/lib/utils/cn"

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined)

interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

const Select = ({ value, onValueChange, children }: SelectProps) => {
  const [internalValue, setInternalValue] = React.useState(value || "")

  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }

  return (
    <SelectContext.Provider value={{ value: value || internalValue, onValueChange: handleChange }}>
      {children}
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { ref, ...props })
  }

  return (
    <select
      ref={ref}
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      value={context?.value || props.value}
      onChange={(e) => {
        context?.onValueChange(e.target.value)
        props.onChange?.(e)
      }}
      {...props}
    >
      {children}
    </select>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder, ...props }: { placeholder?: string } & React.HTMLAttributes<HTMLOptionElement>) => {
  const context = React.useContext(SelectContext)
  if (!context?.value && placeholder) {
    return <option value="" disabled>{placeholder}</option>
  }
  return null
}

const SelectContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  // For native select, content is rendered as options inside the select
  // This component is mainly for compatibility with shadcn/ui API
  return <>{children}</>
}

const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement> & { value: string }
>(({ className, children, ...props }, ref) => {
  return (
    <option
      ref={ref}
      className={cn(className)}
      {...props}
    >
      {children}
    </option>
  )
})
SelectItem.displayName = "SelectItem"

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
}
