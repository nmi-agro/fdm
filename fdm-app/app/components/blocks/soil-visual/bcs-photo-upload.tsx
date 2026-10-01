import { Camera, ChevronDown, Upload } from "lucide-react"
import { type ChangeEvent, useRef } from "react"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

interface PhotoUploadButtonProps {
  onFiles: (files: FileList) => void
  disabled?: boolean
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

  return (
    <>
      {/* Hidden inputs — shared by both mobile and desktop */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />

      {/* Mobile: single button → dropdown */}
      <div className="sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size={size} disabled={disabled}>
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
        <Button type="button" size={size} disabled={disabled} asChild>
          <label className="cursor-pointer">
            <Upload className="size-4" />
            {disabled ? "Uploaden..." : label}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={disabled}
              onChange={handleChange}
            />
          </label>
        </Button>
      </div>
    </>
  )
}
