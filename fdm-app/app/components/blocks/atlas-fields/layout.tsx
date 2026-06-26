import type { ReactNode } from "react"

export function FieldDetailsAtlasLayout({
  cultivationHistory,
  fieldDetails,
  carbon,
  soilTexture,
  groundWater,
}: {
  cultivationHistory: ReactNode
  fieldDetails: ReactNode
  carbon: ReactNode
  soilTexture: ReactNode
  groundWater: ReactNode
}) {
  return (
    <main className="mx-auto max-w-7xl pt-6 pb-20">
      <div className="grid grid-cols-1 items-start gap-6 px-4 md:px-6 lg:grid-cols-12">
        {/* Perceeldetails: Order 1 (Mobile & Desktop right stack) */}
        <div className="order-1 lg:order-2 lg:col-span-8">{fieldDetails}</div>

        {/* Gewashistorie: Order 2 on mobile, Order 1 on desktop (Left Sidebar) */}
        <div className="order-2 lg:sticky lg:top-6 lg:order-1 lg:col-span-4 lg:row-span-10">
          {cultivationHistory}
        </div>

        {/* Remaining Stack: Order 3 (Mobile & Desktop right stack) */}
        <div className="order-3 space-y-6 lg:order-3 lg:col-span-8">
          {carbon}
          {soilTexture}
          {groundWater}
        </div>
      </div>
    </main>
  )
}
