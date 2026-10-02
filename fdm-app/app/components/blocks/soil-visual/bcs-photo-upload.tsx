import { Camera, ChevronDown, Upload } from "lucide-react"
import { type ChangeEvent, useRef } from "react"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Spinner } from "~/components/ui/spinner"

interface PhotoUploadButtonProps {
  onFiles: (files: FileList) => void
  disabled?: boolean
  isUploading?: boolean
  size?: "sm" | "lg"
  label?: string
}

export function createTempId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `tmp-${Math.random().toString(36).slice(2, 10)}`
}

/** On mobile shows a single button with a dropdown (Camera / Galerij).
 *  On desktop shows a regular file-picker button. */
export function PhotoUploadButton({
  onFiles,
  disabled,
  isUploading,
  size = "lg",
  label = "Foto's kiezen",
}: PhotoUploadButtonProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      onFiles(e.target.files)
      e.target.value = ""
    }
  }

  const inputsDisabled = disabled || isUploading

  return (
    <>
      {/* Hidden inputs — shared by both mobile and desktop */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={inputsDisabled}
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={inputsDisabled}
        onChange={handleChange}
      />

      {/* Mobile: single button → dropdown */}
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size={size} disabled={inputsDisabled}>
              {isUploading && <Spinner />}
              <Camera className="size-4" />
              {label}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => cameraRef.current?.click()}>
              <Camera className="size-4" />
              Camera
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => galleryRef.current?.click()}>
              <Upload className="size-4" />
              Galerij kiezen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop: regular file-picker */}
      <div className="hidden sm:block">
        <Button
          type="button"
          size={size}
          disabled={inputsDisabled}
          onClick={() => galleryRef.current?.click()}
        >
          <Upload className="size-4" />
          {isUploading ? "Uploaden..." : label}
          {isUploading && <Spinner />}
        </Button>
      </div>
    </>
  )
}
