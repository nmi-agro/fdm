export function NumberBadge({ number }: { number: number }) {
  return number > 0 ? (
    <div className="bg-destructive ms-auto size-4 rounded-full text-center text-xs text-white">
      {number}
      <span className="sr-only">ongelezen</span>
    </div>
  ) : null
}
