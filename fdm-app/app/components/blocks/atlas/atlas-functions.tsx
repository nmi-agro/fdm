import type { FeatureCollection } from "geojson"
import type { FeatureCollectionFdm, FeatureFdm } from "./atlas.d"

export function generateFeatureClass(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  }
}

type SetFieldsData = (updater: (prevData: FeatureCollectionFdm) => FeatureCollectionFdm) => void

function isFeatureEqual(f1: FeatureFdm, f2: FeatureFdm): boolean {
  return f1.properties.b_id_source === f2.properties.b_id_source
}

export function handleFieldClick(feature: FeatureFdm, setFieldsData: SetFieldsData): void {
  if (!feature?.properties?.b_id_source) {
    console.error("Invalid feature data:", feature)
    return
  }

  const fieldData = {
    type: feature.type,
    geometry: feature.geometry,
    properties: feature.properties,
  }

  setFieldsData((prevFieldsData) => {
    const isAlreadySelected = prevFieldsData.features.some((f) => isFeatureEqual(f, fieldData))

    if (isAlreadySelected) {
      return {
        ...prevFieldsData,
        features: prevFieldsData.features.filter((f) => !isFeatureEqual(f, fieldData)),
      }
    }

    return {
      ...prevFieldsData,
      features: [...prevFieldsData.features, fieldData],
    }
  })
}
