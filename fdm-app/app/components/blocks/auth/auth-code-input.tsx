import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "~/components/ui/input-otp"

interface AuthCodeInputProps {
  field: {
    onChange: (value: string) => void
    value: string | undefined
    onBlur: () => void
    name: string
    ref: React.Ref<HTMLInputElement>
    disabled?: boolean
  }
  onComplete?: (value: string) => void
}

export function AuthCodeInput({ field, onComplete }: AuthCodeInputProps) {
  return (
    <div className="flex justify-center">
      <InputOTP
        maxLength={8}
        {...field}
        pattern="^[a-zA-Z0-9]+$"
        onComplete={onComplete}
        onChange={(value) => {
          field.onChange(value.toUpperCase())
        }}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData("text")
          // Strip non-alphanumeric (dashes, spaces) and limit to 8 chars
          const clean = text
            .replace(/[^a-zA-Z0-9]/g, "")
            .toUpperCase()
            .slice(0, 8)
          field.onChange(clean)
        }}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
          <InputOTPSlot index={6} />
          <InputOTPSlot index={7} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}
