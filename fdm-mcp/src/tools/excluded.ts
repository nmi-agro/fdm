/**
 * fdm-api operations that are deliberately not available as an MCP tool, each with the reason.
 *
 * Every operation of the REST API is either covered by a tool or listed here; a test enforces
 * this, so a new REST endpoint needs a decision. Keep the reasons specific: they are the record of
 * why an assistant cannot do something.
 */
export const EXCLUDED_OPERATIONS: Readonly<Record<string, string>> = {
  // Single records that a list tool already returns in full. Leaving them out keeps the tool
  // list short, which helps models pick the right tool.
  getCultivation: "list_cultivations returns the same records",
  getHarvest: "list_harvests returns the same records",
  getFertilizer: "list_fertilizers returns the same records",
  getFertilizerApplication: "list_fertilizer_applications returns the same records",
  getSoilAnalysis: "list_soil_analyses returns the same records",
  getMeasure: "list_measures returns the same records",
  getOrganicCertification: "list_organic_certifications returns the same records",

  // Rare corrections of the membership history of a farm group.
  updateFarmGroupMembership:
    "corrects the dates of an earlier membership; rarely needed, use the web app or the REST API",
  deleteFarmGroupMembership:
    "erases an earlier membership from the history; rarely needed, use the web app or the REST API",

  // Files. The MCP server does not support file transfer yet: an assistant cannot pass a file
  // the user gives it on to a tool, and tool results cannot carry files. The MCP file uploads
  // extension is still experimental; until clients support it, these stay REST-only.
  downloadSoilAnalysisDocument:
    "file download; the MCP server does not support file transfer yet. Download the lab report in the web app or with the REST API",
  listSoilImages:
    "soil images are photos; the MCP server does not support file transfer yet. Use the web app or the REST API",
  uploadSoilImage:
    "file upload; the MCP server does not support file transfer yet. Upload soil images in the web app or with the REST API",
  downloadSoilImage:
    "file download; the MCP server does not support file transfer yet. Use the web app or the REST API",
  deleteSoilImage:
    "part of the soil image workflow, which needs file transfer that the MCP server does not support yet",
  createSoilImageAnnotation:
    "part of the soil image workflow, which needs file transfer that the MCP server does not support yet",
  updateSoilImageAnnotation:
    "part of the soil image workflow, which needs file transfer that the MCP server does not support yet",
  deleteSoilImageAnnotation:
    "part of the soil image workflow, which needs file transfer that the MCP server does not support yet",
  compareFieldImport:
    "needs an RVO shapefile upload, which the MCP server does not support yet. Import fields in the web app or with the REST API; an assistant can still add fields from GeoJSON with create_field",
  applyFieldImport:
    "needs an RVO shapefile upload, which the MCP server does not support yet. Import fields in the web app or with the REST API",
  compareSoilAnalysisImport:
    "needs a lab report (PDF) upload, which the MCP server does not support yet. Import reports in the web app or with the REST API; an assistant can still read a report itself and enter the values with create_soil_analysis",
  applySoilAnalysisImport:
    "needs a lab report (PDF) upload, which the MCP server does not support yet. Import reports in the web app or with the REST API",

  // Not part of the first MCP release; add when there is a clear use for assistants.
  listFertilizerPlans: "fertilizer plans are generated PDF reports; not in the first release",
  createFertilizerPlan: "fertilizer plans are generated PDF reports; not in the first release",
  getFertilizerPlan: "fertilizer plans are generated PDF reports; not in the first release",
  downloadFertilizerPlanPdf: "binary PDF download",
  deleteFertilizerPlan: "fertilizer plans are generated PDF reports; not in the first release",
  listInvitations: "sharing and invitations are account actions; not in the first release",
  acceptInvitation: "sharing and invitations are account actions; not in the first release",
  declineInvitation: "sharing and invitations are account actions; not in the first release",
}
