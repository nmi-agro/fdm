import type { FdmAuth, FdmType } from "@nmi-agro/fdm-core"
import {
    getFarm,
    getFarms,
    getField,
    getFields,
} from "@nmi-agro/fdm-core"
import { buildApp } from "./app"

export interface FdmApiConfig {
    appName: string
    appUrl: string
    basePath?: string
}

export interface FdmApiServices {
    getFarms: typeof getFarms
    getFarm: typeof getFarm
    getFields: typeof getFields
    getField: typeof getField
}

const defaultServices: FdmApiServices = { getFarms, getFarm, getFields, getField }

export function createFdmApi(
    fdm: FdmType,
    auth: FdmAuth,
    config: FdmApiConfig,
    services: Partial<FdmApiServices> = {},
) {
    return buildApp(fdm, auth, config, { ...defaultServices, ...services })
}

export type { ApiPrincipalContext, ApiEnv } from "./types"
