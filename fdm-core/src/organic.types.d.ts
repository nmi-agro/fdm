import type * as schema from "./db/schema"

export type OrganicCertification = {
    b_id_organic: schema.organicCertificationsTypeSelect["b_id_organic"]
    b_organic_traces: schema.organicCertificationsTypeSelect["b_organic_traces"]
    b_organic_skal: schema.organicCertificationsTypeSelect["b_organic_skal"]
    b_organic_issued: schema.organicCertificationsTypeSelect["b_organic_issued"]
    b_organic_expires: schema.organicCertificationsTypeSelect["b_organic_expires"]
}
