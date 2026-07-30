import { clientConfig } from "~/lib/config"

export function MapTilerAttribution() {
  if (clientConfig.integrations.map.provider !== "maptiler") {
    return null
  }

  return (
    <a
      href="https://www.maptiler.com"
      style={{ position: "absolute", left: 10, bottom: 10, zIndex: 999 }}
      rel="noopener noreferrer"
      target="_blank"
    >
      <img
        src="https://api.maptiler.com/resources/logo.svg"
        alt="MapTiler logo"
        onError={(e) => {
          e.currentTarget.style.display = "none"
        }}
      />
    </a>
  )
}
