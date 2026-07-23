import { REGEXP_ONLY_DIGITS } from "input-otp"
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
  "aria-invalid"?: boolean
}

export function AuthCodeInput({
  field,
  onComplete,
  "aria-invalid": ariaInvalid,
}: AuthCodeInputProps) {
  return (
    <div className="flex justify-center">
      <InputOTP
        maxLength={6}
        {...field}
        aria-invalid={ariaInvalid}
        inputMode="numeric"
        pattern={REGEXP_ONLY_DIGITS}
        onComplete={onComplete}
        onChange={(value) => {
          field.onChange(value)
        }}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData("text")
          // Strip non-digits (dashes, spaces) and limit to 6 chars
          const clean = text.replace(/[^0-9]/g, "").slice(0, 6)
          field.onChange(clean)
        }}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  )
}
