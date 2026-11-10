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

  // Files: binary downloads and multipart uploads do not fit tool arguments and results.
  downloadSoilAnalysisDocument: "binary PDF download",
  listSoilImages: "soil images are photos; not useful without the image files",
  uploadSoilImage: "multipart image upload",
  downloadSoilImage: "binary image download",
  deleteSoilImage: "part of the soil image workflow, which is not available as tools",
  createSoilImageAnnotation: "part of the soil image workflow, which is not available as tools",
  updateSoilImageAnnotation: "part of the soil image workflow, which is not available as tools",
  deleteSoilImageAnnotation: "part of the soil image workflow, which is not available as tools",
  compareFieldImport: "multipart upload of an RVO shapefile",
  applyFieldImport: "applies a multipart RVO shapefile import",
  compareSoilAnalysisImport: "multipart upload of lab PDFs",
  applySoilAnalysisImport: "applies a lab PDF import",

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
