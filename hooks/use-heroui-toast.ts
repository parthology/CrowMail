"use client"

import { addToast } from "@heroui/toast"

interface ToastOptions {
  title: string
  description?: string
  variant?: "solid" | "bordered" | "flat"
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger"
  timeout?: number
  icon?: React.ReactNode
  hideIcon?: boolean
  hideCloseButton?: boolean
}

export function useHeroUIToast() {
  const toast = ({
    title,
    description,
    variant = "flat",
    color = "primary",
    timeout = 4000,
    icon,
    hideIcon = false,
    hideCloseButton = false
  }: ToastOptions) => {
    addToast({
      title,
      description,
      variant,
      color,
      timeout,
      icon,
      hideIcon,
      hideCloseButton,
    })
  }

  return { toast }
}
