"use client"

import { useState } from "react"
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal"
import { Button } from "@heroui/button"
import { Input } from "@heroui/input"
import { Key, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAuth } from "@/contexts/auth-context"
import { useHeroUIToast } from "@/hooks/use-heroui-toast"
import { changePassword } from "@/lib/api"

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const t = useTranslations("changePasswordModal")
  const { currentAccount, token } = useAuth()
  const { toast } = useHeroUIToast()

  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = () => {
    setOldPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setShowOld(false)
    setShowNew(false)
    setIsSubmitting(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!currentAccount) return
    if (!oldPassword || !newPassword) {
      toast({
        title: t("fillAllFields"),
        color: "warning",
        variant: "flat",
        icon: <AlertCircle size={16} />,
      })
      return
    }
    if (newPassword.length < 8) {
      toast({
        title: t("newTooShort"),
        color: "warning",
        variant: "flat",
        icon: <AlertCircle size={16} />,
      })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: t("mismatch"),
        color: "warning",
        variant: "flat",
        icon: <AlertCircle size={16} />,
      })
      return
    }

    if (!token) {
      toast({
        title: t("failed"),
        description: t("noSession"),
        color: "danger",
        variant: "flat",
        icon: <AlertCircle size={16} />,
      })
      return
    }
    setIsSubmitting(true)
    try {
      await changePassword(token, oldPassword, newPassword, currentAccount.providerId)
      toast({
        title: t("success"),
        description: t("successDesc"),
        color: "success",
        variant: "flat",
        icon: <CheckCircle size={16} />,
      })
      handleClose()
    } catch (err: any) {
      const msg = String(err?.message || err)
      const isAuthErr = /invalid password|unauthor|401/i.test(msg)
      toast({
        title: isAuthErr ? t("wrongOld") : t("failed"),
        description: isAuthErr ? undefined : msg,
        color: "danger",
        variant: "flat",
        icon: <AlertCircle size={16} />,
      })
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} placement="center" backdrop="blur" size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Key size={26} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-center">{t("title")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center break-all">
            {currentAccount?.address}
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-3">
            <Input
              type={showOld ? "text" : "password"}
              label={t("oldPassword")}
              value={oldPassword}
              onValueChange={setOldPassword}
              variant="bordered"
              endContent={
                <button type="button" onClick={() => setShowOld(!showOld)} className="focus:outline-none">
                  {showOld ? <EyeOff size={18} className="text-gray-500" /> : <Eye size={18} className="text-gray-500" />}
                </button>
              }
              isDisabled={isSubmitting}
            />
            <Input
              type={showNew ? "text" : "password"}
              label={t("newPassword")}
              value={newPassword}
              onValueChange={setNewPassword}
              variant="bordered"
              description={t("newPasswordHint")}
              endContent={
                <button type="button" onClick={() => setShowNew(!showNew)} className="focus:outline-none">
                  {showNew ? <EyeOff size={18} className="text-gray-500" /> : <Eye size={18} className="text-gray-500" />}
                </button>
              }
              isDisabled={isSubmitting}
            />
            <Input
              type={showNew ? "text" : "password"}
              label={t("confirmPassword")}
              value={confirmPassword}
              onValueChange={setConfirmPassword}
              variant="bordered"
              isDisabled={isSubmitting}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose} isDisabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button color="primary" onPress={handleSubmit} isLoading={isSubmitting}>
            {t("submit")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
