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
        <main className="pt-6 pb-10 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 md:px-6 items-start">
                {/* Perceeldetails: Order 1 (Mobile & Desktop right stack) */}
                <div className="lg:col-span-8 order-1 lg:order-2">
                    {fieldDetails}
                </div>

                {/* Gewashistorie: Order 2 on mobile, Order 1 on desktop (Left Sidebar) */}
                <div className="lg:col-span-4 lg:row-span-10 order-2 lg:order-1 lg:sticky lg:top-6">
                    {cultivationHistory}
                </div>

                {/* Remaining Stack: Order 3 (Mobile & Desktop right stack) */}
                <div className="lg:col-span-8 space-y-6 order-3 lg:order-3">
                    {carbon}
                    {soilTexture}
                    {groundWater}
                </div>
            </div>
        </main>
    )
}
