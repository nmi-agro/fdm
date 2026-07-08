export const CROP_ROTATION_COLORS: Record<string, string> = {
  grass: "#558B2F",
  maize: "#FBC02D",
  cereal: "#C2B280",
  potato: "#8D6E63",
  sugarbeet: "#9B2D30",
  rapeseed: "#D4AC0D",
  clover: "#8BC34A",
  alfalfa: "#7E57C2",
  catchcrop: "#4DD0E1",
  nature: "#00796B",
  starch: "#F57C00",
  other: "#9E9E9E",
}

export function getCultivationTypesHavingColors() {
  return Object.keys(CROP_ROTATION_COLORS)
}

export function getCultivationColor(cultivationType: string | undefined) {
  if (cultivationType) {
    return CROP_ROTATION_COLORS[cultivationType?.toLowerCase()] ?? CROP_ROTATION_COLORS.other
  }
  return CROP_ROTATION_COLORS.other
}
