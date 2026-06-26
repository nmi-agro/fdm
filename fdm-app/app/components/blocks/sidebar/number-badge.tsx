export function NumberBadge({ number }: { number: number }) {
  return number > 0 ? (
    <div className="ms-auto rounded-full size-4 bg-destructive text-xs text-center text-white">
      {number}
      <span className="sr-only">ongelezen</span>
    </div>
  ) : null
}
