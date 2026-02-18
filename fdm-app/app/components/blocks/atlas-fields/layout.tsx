import type { ReactNode } from "react"

export function FieldDetailsAtlasLayout({
    title,
    cultivationHistory,
    fieldDetails,
    carbon,
    soilTexture,
    groundWater,
}: {
    title: ReactNode
    cultivationHistory: ReactNode
    fieldDetails: ReactNode
    carbon: ReactNode
    soilTexture: ReactNode
    groundWater: ReactNode
}) {
    return (
        <main>
            {title}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-10 items-start">
                {/* Cultivation History - Mobile (order 2), Desktop (order 1) */}
                <div className="order-2 lg:order-1 lg:col-span-1">
                    {cultivationHistory}
                </div>
                {/* Grouped Detail Cards - Mobile (order 1, 3, 4, 5), Desktop (order 2) */}
                <div className="contents lg:block lg:order-2 lg:col-span-2 lg:space-y-4">
                    {/* Field Details - Mobile first (order 1) */}
                    <div className="order-1">{fieldDetails}</div>
                    {/* Carbon - Mobile second (order 2) */}
                    <div className="order-2">{carbon}</div>
                    {/* Soil Texture - Mobile third (order 3) */}
                    <div className="order-3">{soilTexture}</div>
                    {/* Ground Water - Mobile fourth (order 4) */}
                    <div className="order-4">{groundWater}</div>
                </div>
            </div>
        </main>
    )
}
