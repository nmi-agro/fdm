import { CarbonSequestrationSkeleton } from "./carbon-sequestration"
import { CultivationHistorySkeleton } from "./cultivation-history"
import { FieldDetailsSkeleton } from "./field-details"
import { GroundwaterSkeleton } from "./groundwater"
import { FieldDetailsAtlasLayout } from "./layout"
import { SoilTextureSkeleton } from "./soil-texture"

export function FieldDetailsAtlasSkeleton() {
  return (
    <div className="mx-auto max-w-7xl">
      <FieldDetailsAtlasLayout
        cultivationHistory={<CultivationHistorySkeleton />}
        fieldDetails={<FieldDetailsSkeleton />}
        carbon={<CarbonSequestrationSkeleton />}
        soilTexture={<SoilTextureSkeleton />}
        groundWater={<GroundwaterSkeleton />}
      />
    </div>
  )
}
