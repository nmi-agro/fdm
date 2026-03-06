import { Document, Image, Link, Page, Text, View } from "@react-pdf/renderer"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { PdfCard } from "../PdfCard"
import {
    PdfTable,
    PdfTableCell,
    PdfTableHeader,
    PdfTableRow,
} from "../PdfTable"
import { pdfStyles } from "./styles"
import type { BemestingsplanData } from "./types"

const Footer = ({
    config,
    style,
    showPageNumbers = true,
}: {
    config: { name: string }
    style?: any
    showPageNumbers?: boolean
}) => {
    if (showPageNumbers) {
        return (
            <View style={[pdfStyles.footer, style]} fixed>
                <Text>
                    {config.name} - Gegenereerd op{" "}
                    {format(new Date(), "d MMMM yyyy", { locale: nl })}
                </Text>
                {showPageNumbers && (
                    <Text
                        render={({ pageNumber, totalPages }) =>
                            `Pagina ${pageNumber} / ${totalPages}`
                        }
                    />
                )}
            </View>
        )
    }
    return null
}

const SectionHeader = ({ children }: { children: string }) => (
    <Text style={pdfStyles.sectionTitle}>{children}</Text>
)

/**
 * Renders a chemical symbol with subscripts using nested Text components.
 * This is the most reliable way to achieve subscripts in react-pdf with standard fonts.
 */
const Chemical = ({ symbol, style }: { symbol: string; style?: any }) => {
    const parts = symbol.split(/(\d+)/)
    return (
        <Text style={style}>
            {parts.map((part, i) => (
                <Text
                    // biome-ignore lint/suspicious/noArrayIndexKey: simple split, stable order
                    key={`${part}-${i}`}
                    style={/^\d+$/.test(part) ? { fontSize: 6 } : {}}
                >
                    {part}
                </Text>
            ))}
        </Text>
    )
}

const soilTypeLabels: Record<string, string> = {
    moerige_klei: "Moerige klei",
    rivierklei: "Rivierklei",
    dekzand: "Dekzand",
    zeeklei: "Zeeklei",
    dalgrond: "Dalgrond",
    veen: "Veen",
    loess: "Löss",
    duinzand: "Duinzand",
    maasklei: "Maasklei",
}

const FrontPage = ({ data }: { data: BemestingsplanData }) => (
    <Page size="A4" style={pdfStyles.frontPage}>
        <View
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
            }}
        >
            {/* Using local cover image passed from loader */}
            {data.config.coverImage ? (
                <Image
                    src={data.config.coverImage}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
            ) : (
                <View
                    style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#0f172a",
                    }}
                />
            )}
            <View
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    backgroundColor: "rgba(0,0,0,0.4)",
                }}
            />
        </View>

        <View
            style={{
                flex: 1,
                flexDirection: "column",
                justifyContent: "space-between",
            }}
        >
            <View
                style={[
                    pdfStyles.frontHeader,
                    {
                        alignItems: "center",
                        flex: 1,
                        justifyContent: "center",
                    },
                ]}
            >
                <View style={{ marginBottom: 40, alignItems: "center" }}>
                    {/* {data.config.logo ? (
                        <Image src={data.config.logo} style={pdfStyles.frontLogo} />
                    ) : data.config.logoInverted ? (
                        <Image
                            src={data.config.logoInverted}
                            style={pdfStyles.frontLogo}
                        />
                    ) : null} */}
                    <Text
                        style={{
                            fontSize: 24,
                            fontWeight: "bold",
                            color: "#FFFFFF",
                            marginTop: 10,
                            textAlign: "center",
                        }}
                    >
                        {data.config.name}
                    </Text>
                </View>

                <View
                    style={[
                        pdfStyles.frontTitleContainer,
                        { alignItems: "center" },
                    ]}
                >
                    <Text
                        style={[pdfStyles.frontTitle, { textAlign: "center" }]}
                    >
                        Bemestingsplan
                    </Text>
                    <Text
                        style={[
                            pdfStyles.frontSubtitle,
                            { textAlign: "center", color: "#FFFFFF" },
                        ]}
                    >
                        {data.year}
                    </Text>
                </View>
            </View>

            <View style={pdfStyles.frontFooter}>
                <Text style={pdfStyles.frontFarmName}>{data.farm.name}</Text>
                <View style={{ marginTop: 10, opacity: 0.8 }}>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                        }}
                    >
                        <Text style={pdfStyles.frontInfo}>
                            KvK: {data.farm.kvk || "-"}
                        </Text>
                        <Text style={pdfStyles.frontInfo}>
                            Oppervlakte: {data.totalArea.toFixed(1)} ha
                        </Text>
                    </View>
                    <Text style={[pdfStyles.frontInfo, { marginTop: 20 }]}>
                        Datum:{" "}
                        {format(new Date(), "d MMMM yyyy", { locale: nl })}
                    </Text>
                </View>
            </View>
        </View>
        <Footer
            config={data.config}
            style={{ color: "#FFFFFF", borderTopWidth: 0 }}
            showPageNumbers={false}
        />
    </Page>
)

const UsageBar = ({
    planned,
    limit,
    label,
    unit,
}: {
    planned: number
    limit: number
    label: string
    unit: string
}) => {
    let percentage = 0
    if (limit > 0) {
        percentage = Math.min(100, (planned / limit) * 100)
    } else if (planned > 0) {
        percentage = 100
    }

    const safePercentage = Number.isNaN(percentage) ? 0 : percentage

    // Orange if over limit (including if limit is 0 and planned > 0), else Blue
    const color = planned > limit ? "#f97316" : "#3b82f6"

    return (
        <View style={{ marginBottom: 10 }}>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 2,
                }}
            >
                <Text style={{ fontSize: 8 }}>{label}</Text>
                <Text style={{ fontSize: 8, fontWeight: "bold" }}>
                    {Math.round(planned)} / {Math.round(limit)} {unit}
                </Text>
            </View>
            <View
                style={{
                    height: 6,
                    backgroundColor: "#f1f5f9",
                    borderRadius: 3,
                    overflow: "hidden",
                }}
            >
                <View
                    style={{
                        height: "100%",
                        width: `${safePercentage}%`,
                        backgroundColor: color,
                        borderRadius: 3,
                    }}
                />
            </View>
        </View>
    )
}

const TableOfContents = ({ data }: { data: BemestingsplanData }) => (
    <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
            <View>
                {data.config.logo ? (
                    <Image src={data.config.logo} style={pdfStyles.logo} />
                ) : (
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: "#0f172a",
                        }}
                    >
                        {data.config.name}
                    </Text>
                )}
            </View>
            <View style={{ alignItems: "flex-end" }}>
                <Text style={pdfStyles.title}>Inhoudsopgave</Text>
            </View>
        </View>

        <View style={{ marginTop: 20, flex: 1 }}>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    borderBottomWidth: 1,
                    borderBottomColor: "#f1f5f9",
                    paddingBottom: 5,
                    marginBottom: 5,
                }}
            >
                <Text
                    style={{
                        fontWeight: "bold",
                        fontSize: 10,
                        color: "#64748b",
                    }}
                >
                    ONDERDEEL
                </Text>
                <Text
                    style={{
                        fontWeight: "bold",
                        fontSize: 10,
                        color: "#64748b",
                    }}
                >
                    PAGINA
                </Text>
            </View>
            <Link
                src="#farm-summary"
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 5,
                    textDecoration: "none",
                    color: "#020617",
                }}
            >
                <Text>Samenvatting bedrijf</Text>
                <Text>3</Text>
            </Link>
            <Link
                src="#fields-overview"
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 5,
                    textDecoration: "none",
                    color: "#020617",
                }}
            >
                <Text>Overzicht percelen</Text>
                <Text>4</Text>
            </Link>
            <Link
                src="#fertilizer-totals"
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 5,
                    textDecoration: "none",
                    color: "#020617",
                }}
            >
                <Text>Benodigde meststoffen</Text>
                <Text>3</Text>
            </Link>
            <View
                style={{
                    marginTop: 15,
                    marginBottom: 5,
                    borderBottomWidth: 1,
                    borderBottomColor: "#f1f5f9",
                    paddingBottom: 2,
                }}
            >
                <Text
                    style={{
                        fontWeight: "bold",
                        fontSize: 10,
                        color: "#64748b",
                    }}
                >
                    PERCEELSVERSLAGEN
                </Text>
            </View>
            {data.fields
                .filter((f) => !f.isBufferstrip)
                .map((field, i) => (
                    <Link
                        key={field.id}
                        src={`#field-${field.id}`}
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            paddingVertical: 3,
                            paddingLeft: 10,
                            textDecoration: "none",
                            color: "#020617",
                        }}
                    >
                        <Text style={{ fontSize: 9 }}>{field.name}</Text>
                        <Text style={{ fontSize: 9 }}>{5 + i}</Text>
                    </Link>
                ))}
            {data.fields.some((f) => f.isBufferstrip) && (
                <>
                    <View
                        style={{
                            marginTop: 15,
                            marginBottom: 5,
                            borderBottomWidth: 1,
                            borderBottomColor: "#f1f5f9",
                            paddingBottom: 2,
                        }}
                    >
                        <Text
                            style={{
                                fontWeight: "bold",
                                fontSize: 10,
                                color: "#64748b",
                            }}
                        >
                            OVERIG
                        </Text>
                    </View>
                    <Link
                        src="#bufferstrips"
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            paddingVertical: 5,
                            textDecoration: "none",
                            color: "#020617",
                        }}
                    >
                        <Text>Bufferstroken</Text>
                        <Text>
                            {4 +
                                data.fields.filter((f) => !f.isBufferstrip)
                                    .length +
                                1}
                        </Text>
                    </Link>
                </>
            )}
        </View>

        <View
            style={{
                marginTop: 20,
                borderTopWidth: 1,
                borderTopColor: "#e2e8f0",
                paddingTop: 10,
            }}
        >
            <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 5 }}>
                Disclaimer
            </Text>
            <Text
                style={{
                    fontSize: 8,
                    color: "#64748b",
                    lineHeight: 1.4,
                }}
            >
                De berekeningen van de gebruiksruimte en het bemestingsadvies in
                dit document zijn gebaseerd op de door de gebruiker verstrekte
                gegevens en de op het moment van genereren geldende wet- en
                regelgeving. Deze getallen zijn uitsluitend bedoeld voor
                informatieve doeleinden en dienen als indicatie. Hoewel{" "}
                {data.config.name} streeft naar maximale nauwkeurigheid, kunnen
                er geen rechten worden ontleend aan de gepresenteerde waarden.
                De uiteindelijke verantwoordelijkheid voor de naleving van de
                mestwetgeving ligt bij de landbouwer. Raadpleeg bij twijfel
                altijd de officiële publicaties van de Rijksdienst voor
                Ondernemend Nederland (RVO) en uw adviseur.
            </Text>
        </View>

        <Footer config={data.config} />
    </Page>
)

export const BemestingsplanPDF = ({ data }: { data: BemestingsplanData }) => (
    <Document title={`Bemestingsplan ${data.year} - ${data.farm.name}`}>
        {/* Page 1: Front Page */}
        <FrontPage data={data} />

        {/* Page 2: Table of Contents */}
        <TableOfContents data={data} />

        {/* Page 3: Farm Summary */}
        <Page size="A4" style={pdfStyles.page} id="farm-summary">
            <View style={pdfStyles.header}>
                <View>
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: "#0f172a",
                        }}
                    >
                        {data.config.name}
                    </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                    <Text style={pdfStyles.title}>
                        Samenvatting {data.year}
                    </Text>
                </View>
            </View>

            <View style={{ marginTop: 20 }}>
                <SectionHeader>Bedrijfsgegevens</SectionHeader>
                <PdfCard>
                    <View style={pdfStyles.grid}>
                        <View style={[pdfStyles.gridCol, { width: "40%" }]}>
                            <Text style={pdfStyles.label}>Bedrijfsnaam</Text>
                            <Text style={pdfStyles.value}>
                                {data.farm.name}
                            </Text>
                        </View>
                        <View style={[pdfStyles.gridCol, { width: "30%" }]}>
                            <Text style={pdfStyles.label}>kvk nummer</Text>
                            <Text style={pdfStyles.value}>
                                {data.farm.kvk || "-"}
                            </Text>
                        </View>
                        <View style={[pdfStyles.gridCol, { width: "30%" }]}>
                            <Text style={pdfStyles.label}>
                                totaal oppervlakte
                            </Text>
                            <Text style={pdfStyles.value}>
                                {data.totalArea.toFixed(1)} ha
                            </Text>
                            <Text style={[pdfStyles.label, { marginTop: 4 }]}>
                                productieve opp.
                            </Text>
                            <Text style={pdfStyles.value}>
                                {data.productiveArea.toFixed(1)} ha
                            </Text>
                        </View>
                    </View>
                </PdfCard>
            </View>

            <View style={{ marginTop: 10 }}>
                <View style={pdfStyles.grid}>
                    <View style={{ width: "50%", paddingRight: 5 }}>
                        <SectionHeader>
                            Gebruiksruimte (gepland / ruimte)
                        </SectionHeader>
                        <PdfCard style={{ padding: 8 }}>
                            <View style={{ paddingVertical: 2 }}>
                                <UsageBar
                                    label="Stikstof werkzaam (N-w)"
                                    planned={data.normsFilling.nitrogen}
                                    limit={data.norms.nitrogen}
                                    unit="kg N"
                                />
                                <UsageBar
                                    label="Dierlijke mest"
                                    planned={data.normsFilling.manure}
                                    limit={data.norms.manure}
                                    unit="kg N"
                                />
                                <UsageBar
                                    label="Fosfaat"
                                    planned={data.normsFilling.phosphate}
                                    limit={data.norms.phosphate}
                                    unit="kg P2O5"
                                />
                            </View>
                        </PdfCard>
                    </View>
                    <View style={{ width: "50%", paddingLeft: 5 }}>
                        <SectionHeader>
                            Bemestingsadvies (gepland / advies)
                        </SectionHeader>
                        <PdfCard style={{ padding: 8 }}>
                            <View style={{ paddingVertical: 2 }}>
                                <UsageBar
                                    label="Stikstof werkzaam (N-w)"
                                    planned={data.plannedUsage.p_dose_nw}
                                    limit={data.totalAdvice.d_n_req}
                                    unit="kg"
                                />
                                <UsageBar
                                    label="Fosfaat (P2O5)"
                                    planned={data.plannedUsage.p_dose_p}
                                    limit={data.totalAdvice.d_p_req}
                                    unit="kg"
                                />
                                <UsageBar
                                    label="Kalium (K2O)"
                                    planned={data.plannedUsage.p_dose_k}
                                    limit={data.totalAdvice.d_k_req}
                                    unit="kg"
                                />
                            </View>
                        </PdfCard>
                    </View>
                </View>

                {/* New Section: OS Balans & Crop Summary */}
                <View style={[pdfStyles.grid, { marginTop: 5 }]}>
                    <View style={{ width: "50%", paddingRight: 5 }}>
                        <SectionHeader>OS Balans (gem. per ha)</SectionHeader>
                        <PdfCard style={{ padding: 8 }}>
                            <View style={{ paddingVertical: 2, gap: 4 }}>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <Text style={{ fontSize: 8 }}>
                                        Aanvoer (EOS)
                                    </Text>
                                    <Text
                                        style={[
                                            pdfStyles.value,
                                            { fontSize: 9 },
                                        ]}
                                    >
                                        {data.omBalance
                                            ? Math.round(data.omBalance.supply)
                                            : 0}{" "}
                                        kg
                                    </Text>
                                </View>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <Text style={{ fontSize: 8 }}>
                                        Afbraak (OS)
                                    </Text>
                                    <Text
                                        style={[
                                            pdfStyles.value,
                                            { fontSize: 9 },
                                        ]}
                                    >
                                        {data.omBalance
                                            ? Math.round(
                                                  data.omBalance.degradation,
                                              )
                                            : 0}{" "}
                                        kg
                                    </Text>
                                </View>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        borderTopWidth: 1,
                                        borderTopColor: "#f1f5f9",
                                        paddingTop: 2,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: 8,
                                            fontWeight: "bold",
                                        }}
                                    >
                                        Balans
                                    </Text>
                                    <Text
                                        style={[
                                            pdfStyles.value,
                                            {
                                                fontSize: 9,
                                                color:
                                                    (data.omBalance?.balance ??
                                                        0) >= 0
                                                        ? "#22c55e"
                                                        : "#ef4444",
                                            },
                                        ]}
                                    >
                                        {data.omBalance
                                            ? Math.round(data.omBalance.balance)
                                            : 0}{" "}
                                        kg OS
                                    </Text>
                                </View>
                            </View>
                        </PdfCard>
                    </View>
                    <View style={{ width: "50%", paddingLeft: 5 }}>
                        <SectionHeader>Gewasoverzicht</SectionHeader>
                        <PdfCard style={{ padding: 8 }}>
                            {(() => {
                                const productiveFields = data.fields.filter(
                                    (f) => !f.isBufferstrip,
                                )
                                const bufferFields = data.fields.filter(
                                    (f) => f.isBufferstrip,
                                )

                                const getCrops = (
                                    fields: typeof data.fields,
                                ) => {
                                    return fields.reduce(
                                        (acc, f) => {
                                            const crop =
                                                f.mainCrop || "Onbekend"
                                            acc[crop] =
                                                (acc[crop] || 0) + f.area
                                            return acc
                                        },
                                        {} as Record<string, number>,
                                    )
                                }

                                const productiveCrops =
                                    getCrops(productiveFields)
                                const bufferCrops = getCrops(bufferFields)
                                const bufferTotal = bufferFields.reduce(
                                    (sum, f) => sum + f.area,
                                    0,
                                )
                                const farmTotal = data.fields.reduce(
                                    (sum, f) => sum + f.area,
                                    0,
                                )

                                const renderCropList = (
                                    crops: Record<string, number>,
                                    total: number,
                                    title?: string,
                                ) => (
                                    <View
                                        style={{
                                            gap: 2,
                                            marginBottom: title ? 6 : 0,
                                        }}
                                    >
                                        {title && (
                                            <Text
                                                style={{
                                                    fontSize: 8,
                                                    fontWeight: "bold",
                                                    marginBottom: 2,
                                                    textDecoration: "underline",
                                                }}
                                            >
                                                {title}
                                            </Text>
                                        )}
                                        {Object.entries(crops)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([crop, area]) => (
                                                <View
                                                    key={crop}
                                                    style={{
                                                        flexDirection: "row",
                                                        justifyContent:
                                                            "space-between",
                                                    }}
                                                >
                                                    <Text
                                                        style={{ fontSize: 8 }}
                                                    >
                                                        {crop}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            pdfStyles.value,
                                                            { fontSize: 9 },
                                                        ]}
                                                    >
                                                        {area.toFixed(1)} ha (
                                                        {(
                                                            (area / farmTotal) *
                                                            100
                                                        ).toFixed(1)}
                                                        %)
                                                    </Text>
                                                </View>
                                            ))}
                                        <View
                                            style={{
                                                flexDirection: "row",
                                                justifyContent: "space-between",
                                                borderTopWidth: 1,
                                                borderTopColor: "#f1f5f9",
                                                paddingTop: 2,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 8,
                                                    fontWeight: "bold",
                                                }}
                                            >
                                                Totaal
                                            </Text>
                                            <Text
                                                style={[
                                                    pdfStyles.value,
                                                    { fontSize: 9 },
                                                ]}
                                            >
                                                {total.toFixed(2)} ha (
                                                {(
                                                    (total / farmTotal) *
                                                    100
                                                ).toFixed(1)}
                                                %)
                                            </Text>
                                        </View>
                                    </View>
                                )

                                return (
                                    <View>
                                        {renderCropList(
                                            productiveCrops,
                                            data.productiveArea,
                                            Object.keys(bufferCrops).length > 0
                                                ? "Productief"
                                                : undefined,
                                        )}
                                        {Object.keys(bufferCrops).length >
                                            0 && (
                                            <>
                                                <View
                                                    style={{
                                                        height: 1,
                                                        backgroundColor:
                                                            "#e2e8f0",
                                                        marginVertical: 4,
                                                    }}
                                                />
                                                {renderCropList(
                                                    bufferCrops,
                                                    bufferTotal,
                                                    "Bufferstroken",
                                                )}
                                            </>
                                        )}
                                    </View>
                                )
                            })()}
                        </PdfCard>
                    </View>
                </View>

                {/* New Section: Fertilizer Totals */}
                <View
                    style={{ marginTop: 5 }}
                    wrap={false}
                    id="fertilizer-totals"
                >
                    <SectionHeader>
                        Benodigde meststoffen (Totaal)
                    </SectionHeader>
                    <PdfCard style={{ padding: 0 }}>
                        <PdfTable
                            style={{
                                marginTop: 0,
                                borderTopWidth: 0,
                                borderRightWidth: 0,
                                borderBottomWidth: 0,
                                borderLeftWidth: 0,
                            }}
                        >
                            <View
                                style={[
                                    pdfStyles.tableHeader,
                                    {
                                        backgroundColor: "#f8fafc",
                                        borderBottomWidth: 1,
                                        borderBottomColor: "#e2e8f0",
                                    },
                                ]}
                            >
                                <PdfTableCell weight={2}>
                                    <Text>Product</Text>
                                </PdfTableCell>
                                <PdfTableCell style={{ textAlign: "right" }}>
                                    <Text>Totaal (kg)</Text>
                                </PdfTableCell>
                                <PdfTableCell style={{ textAlign: "right" }}>
                                    <Text>N-totaal (kg)</Text>
                                </PdfTableCell>
                                <PdfTableCell style={{ textAlign: "right" }}>
                                    <Text>N-werkzaam (kg)</Text>
                                </PdfTableCell>
                                <PdfTableCell style={{ textAlign: "right" }}>
                                    <Text>P2O5 (kg)</Text>
                                </PdfTableCell>
                                <PdfTableCell style={{ textAlign: "right" }}>
                                    <Text>K2O (kg)</Text>
                                </PdfTableCell>
                            </View>
                            {(() => {
                                const fertilizers = data.fields
                                    .filter((f) => !f.isBufferstrip)
                                    .reduce(
                                        (acc, f) => {
                                            f.applications.forEach((app) => {
                                                if (!acc[app.product]) {
                                                    acc[app.product] = {
                                                        amount: 0,
                                                        n: 0,
                                                        nw: 0,
                                                        p: 0,
                                                        k: 0,
                                                    }
                                                }
                                                // app.quantity is per ha, so multiply by area
                                                acc[app.product].amount +=
                                                    app.quantity * f.area
                                                acc[app.product].n +=
                                                    app.p_dose_n * f.area
                                                acc[app.product].nw +=
                                                    app.p_dose_nw * f.area
                                                acc[app.product].p +=
                                                    app.p_dose_p * f.area
                                                acc[app.product].k +=
                                                    app.p_dose_k * f.area
                                            })
                                            return acc
                                        },
                                        {} as Record<
                                            string,
                                            {
                                                amount: number
                                                n: number
                                                nw: number
                                                p: number
                                                k: number
                                            }
                                        >,
                                    )

                                if (Object.keys(fertilizers).length === 0) {
                                    return (
                                        <View style={{ padding: 10 }}>
                                            <Text
                                                style={{
                                                    fontSize: 8,
                                                    color: "#64748b",
                                                }}
                                            >
                                                Geen bemesting gepland.
                                            </Text>
                                        </View>
                                    )
                                }

                                return Object.entries(fertilizers)
                                    .sort(([, a], [, b]) => b.amount - a.amount)
                                    .map(([name, stats], i) => (
                                        <View
                                            key={name}
                                            style={[
                                                pdfStyles.tableRow,
                                                {
                                                    borderBottomWidth:
                                                        i ===
                                                        Object.keys(fertilizers)
                                                            .length -
                                                            1
                                                            ? 0
                                                            : 1,
                                                },
                                            ]}
                                        >
                                            <PdfTableCell weight={2}>
                                                <Text
                                                    style={{
                                                        fontWeight: "bold",
                                                        fontSize: 8,
                                                    }}
                                                >
                                                    {name}
                                                </Text>
                                            </PdfTableCell>
                                            <PdfTableCell
                                                style={{ textAlign: "right" }}
                                            >
                                                <Text>
                                                    {Math.round(
                                                        stats.amount,
                                                    ).toLocaleString(
                                                        "nl-NL",
                                                    )}{" "}
                                                    kg
                                                </Text>
                                            </PdfTableCell>
                                            <PdfTableCell
                                                style={{ textAlign: "right" }}
                                            >
                                                <Text>
                                                    {Math.round(
                                                        stats.n,
                                                    ).toLocaleString("nl-NL")}
                                                </Text>
                                            </PdfTableCell>
                                            <PdfTableCell
                                                style={{ textAlign: "right" }}
                                            >
                                                <Text>
                                                    {Math.round(
                                                        stats.nw,
                                                    ).toLocaleString("nl-NL")}
                                                </Text>
                                            </PdfTableCell>
                                            <PdfTableCell
                                                style={{ textAlign: "right" }}
                                            >
                                                <Text>
                                                    {Math.round(
                                                        stats.p,
                                                    ).toLocaleString("nl-NL")}
                                                </Text>
                                            </PdfTableCell>
                                            <PdfTableCell
                                                style={{ textAlign: "right" }}
                                            >
                                                <Text>
                                                    {Math.round(
                                                        stats.k,
                                                    ).toLocaleString("nl-NL")}
                                                </Text>
                                            </PdfTableCell>
                                        </View>
                                    ))
                            })()}
                        </PdfTable>
                    </PdfCard>
                </View>
            </View>
            <Footer config={data.config} />
        </Page>

        {/* Page 4: Fields Overview Table */}
        <Page size="A4" orientation="landscape" style={pdfStyles.page}>
            <View style={pdfStyles.header} id="fields-overview">
                <Text style={pdfStyles.title}>
                    Overzicht percelen {data.year}
                </Text>
            </View>
            <PdfTable>
                <View fixed>
                    <View
                        style={{
                            flexDirection: "row",
                            borderBottomWidth: 1,
                            borderBottomColor: "#e2e8f0",
                        }}
                    >
                        <PdfTableCell weight={2.1}>
                            <Text> </Text>
                        </PdfTableCell>
                        <PdfTableCell
                            weight={3}
                            style={{
                                backgroundColor: "#f1f5f9",
                                textAlign: "center",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 8,
                                    fontWeight: "bold",
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                }}
                            >
                                Gebruiksruimte (gepland / ruimte) (kg/ha)
                            </Text>
                        </PdfTableCell>
                        <PdfTableCell
                            weight={3}
                            style={{
                                backgroundColor: "#ecf2ff",
                                textAlign: "center",
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 8,
                                    fontWeight: "bold",
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                }}
                            >
                                Bemestingsadvies (gepland / advies) (kg/ha)
                            </Text>
                        </PdfTableCell>
                    </View>
                    <View style={pdfStyles.tableHeader}>
                        <PdfTableCell weight={1.5}>
                            <Text>Perceel</Text>
                        </PdfTableCell>
                        <PdfTableCell
                            weight={0.6}
                            style={{ textAlign: "right" }}
                        >
                            <Text>Opp (ha)</Text>
                        </PdfTableCell>
                        <PdfTableCell style={{ textAlign: "right" }}>
                            <Text>N-werkzaam</Text>
                        </PdfTableCell>
                        <PdfTableCell style={{ textAlign: "right" }}>
                            <Text>N-dierlijk</Text>
                        </PdfTableCell>
                        <PdfTableCell style={{ textAlign: "right" }}>
                            <Text>
                                <Chemical symbol="P2O5" />
                            </Text>
                        </PdfTableCell>
                        <PdfTableCell style={{ textAlign: "right" }}>
                            <Text>N-werkzaam</Text>
                        </PdfTableCell>
                        <PdfTableCell style={{ textAlign: "right" }}>
                            <Text>
                                <Chemical symbol="P2O5" />
                            </Text>
                        </PdfTableCell>
                        <PdfTableCell style={{ textAlign: "right" }}>
                            <Text>
                                <Chemical symbol="K2O" />
                            </Text>
                        </PdfTableCell>
                    </View>
                </View>
                {data.fields
                    .filter((f) => !f.isBufferstrip)
                    .map((field) => (
                        <View
                            key={field.id}
                            wrap={false}
                            style={pdfStyles.tableRow}
                        >
                            <PdfTableCell weight={1.5}>
                                <Text style={{ fontWeight: "bold" }}>
                                    {field.name}
                                </Text>
                                <Text style={{ fontSize: 7, color: "#64748b" }}>
                                    {field.mainCrop}
                                </Text>
                            </PdfTableCell>
                            <PdfTableCell
                                weight={0.6}
                                style={{ textAlign: "right" }}
                            >
                                <Text>{field.area.toFixed(2)}</Text>
                            </PdfTableCell>
                            <PdfTableCell style={{ textAlign: "right" }}>
                                <Text>
                                    {Math.round(field.normsFilling.nitrogen)} /{" "}
                                    {Math.round(field.norms.nitrogen)}
                                </Text>
                            </PdfTableCell>
                            <PdfTableCell style={{ textAlign: "right" }}>
                                <Text>
                                    {Math.round(field.normsFilling.manure)} /{" "}
                                    {Math.round(field.norms.manure)}
                                </Text>
                            </PdfTableCell>
                            <PdfTableCell style={{ textAlign: "right" }}>
                                <Text>
                                    {Math.round(field.normsFilling.phosphate)} /{" "}
                                    {Math.round(field.norms.phosphate)}
                                </Text>
                            </PdfTableCell>
                            <PdfTableCell style={{ textAlign: "right" }}>
                                <Text>
                                    {Math.round(field.planned.p_dose_nw)} /{" "}
                                    {Math.round(field.advice.d_n_req)}
                                </Text>
                            </PdfTableCell>
                            <PdfTableCell style={{ textAlign: "right" }}>
                                <Text>
                                    {Math.round(field.planned.p_dose_p)} /{" "}
                                    {Math.round(field.advice.d_p_req)}
                                </Text>
                            </PdfTableCell>
                            <PdfTableCell style={{ textAlign: "right" }}>
                                <Text>
                                    {Math.round(field.planned.p_dose_k)} /{" "}
                                    {Math.round(field.advice.d_k_req)}
                                </Text>
                            </PdfTableCell>
                        </View>
                    ))}
            </PdfTable>
            <Footer config={data.config} />
        </Page>

        {/* Detailed Field Reports */}
        {data.fields
            .filter((f) => !f.isBufferstrip)
            .map((field) => (
                <Page key={field.id} size="A4" style={pdfStyles.page}>
                    <Text
                        style={[pdfStyles.miniHeader, { opacity: 0.6 }]}
                        fixed
                    >
                        {field.name} ({field.area.toFixed(1)} ha)
                    </Text>

                    <View style={pdfStyles.header} id={`field-${field.id}`}>
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: "bold" }}>
                                {field.name}
                            </Text>
                            <Text style={{ color: "#64748b", fontSize: 10 }}>
                                {field.area.toFixed(1)} ha — {field.mainCrop}
                            </Text>
                        </View>
                        {data.config.logo && (
                            <Image
                                src={data.config.logo}
                                style={{ width: 40 }}
                            />
                        )}
                    </View>

                    <View style={pdfStyles.grid}>
                        <View style={{ width: "50%", paddingRight: 5 }}>
                            <SectionHeader>Bodem</SectionHeader>
                            <PdfCard style={{ padding: 8 }}>
                                <View style={{ gap: 3 }}>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Text style={{ fontSize: 8 }}>
                                            Organische stof (%)
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.value,
                                                { fontSize: 9 },
                                            ]}
                                        >
                                            {field.soil.a_som_loi !== undefined
                                                ? field.soil.a_som_loi.toFixed(
                                                      1,
                                                  )
                                                : "-"}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Text style={{ fontSize: 8 }}>
                                            Bodemtype
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.value,
                                                { fontSize: 9 },
                                            ]}
                                        >
                                            {field.soil.b_soiltype_agr
                                                ? soilTypeLabels[
                                                      field.soil.b_soiltype_agr
                                                  ] || field.soil.b_soiltype_agr
                                                : "-"}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Text style={{ fontSize: 8 }}>
                                            Klei / Silt / Zand (%)
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.value,
                                                { fontSize: 9 },
                                            ]}
                                        >
                                            {field.soil.a_clay_mi ?? "-"} /{" "}
                                            {field.soil.a_silt_mi ?? "-"} /{" "}
                                            {field.soil.a_sand_mi ?? "-"}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Text style={{ fontSize: 8 }}>
                                            Fosfaat (P-Al / P-CaCl)
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.value,
                                                { fontSize: 9 },
                                            ]}
                                        >
                                            {field.soil.a_p_al ?? "-"} /{" "}
                                            {field.soil.a_p_cc ?? "-"}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Text style={{ fontSize: 8 }}>
                                            Kalium (K-CaCl)
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.value,
                                                { fontSize: 9 },
                                            ]}
                                        >
                                            {field.soil.a_k_cc ?? "-"}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Text style={{ fontSize: 8 }}>
                                            Zuurgraad (pH-CaCl)
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.value,
                                                { fontSize: 9 },
                                            ]}
                                        >
                                            {field.soil.a_ph_cc !== undefined
                                                ? field.soil.a_ph_cc.toFixed(1)
                                                : "-"}
                                        </Text>
                                    </View>
                                </View>
                            </PdfCard>
                        </View>

                        <View style={{ width: "50%", paddingLeft: 5 }}>
                            <SectionHeader>Teeltplan</SectionHeader>
                            <PdfCard style={{ padding: 8 }}>
                                <View style={{ gap: 3 }}>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Text style={{ fontSize: 8 }}>
                                            Hoofdteelt
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.value,
                                                {
                                                    fontSize: 9,
                                                    textAlign: "right",
                                                },
                                            ]}
                                        >
                                            {field.mainCrop}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: "row",
                                            justifyContent: "space-between",
                                        }}
                                    >
                                        <Text style={{ fontSize: 8 }}>
                                            Vanggewas
                                        </Text>
                                        <Text
                                            style={[
                                                pdfStyles.value,
                                                {
                                                    fontSize: 9,
                                                    textAlign: "right",
                                                },
                                            ]}
                                        >
                                            {field.catchCrop || "-"}
                                        </Text>
                                    </View>
                                </View>
                            </PdfCard>

                            {field.omBalance && (
                                <View style={{ marginTop: 2 }}>
                                    <SectionHeader>
                                        Organische stofbalans
                                    </SectionHeader>
                                    <PdfCard style={{ padding: 8 }}>
                                        <View style={{ gap: 2 }}>
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    justifyContent:
                                                        "space-between",
                                                }}
                                            >
                                                <Text style={{ fontSize: 8 }}>
                                                    Aanvoer (EOS)
                                                </Text>
                                                <Text
                                                    style={[
                                                        pdfStyles.value,
                                                        { fontSize: 9 },
                                                    ]}
                                                >
                                                    {Math.round(
                                                        field.omBalance.supply,
                                                    )}{" "}
                                                    kg/ha
                                                </Text>
                                            </View>
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    justifyContent:
                                                        "space-between",
                                                }}
                                            >
                                                <Text style={{ fontSize: 8 }}>
                                                    Afbraak (OS)
                                                </Text>
                                                <Text
                                                    style={[
                                                        pdfStyles.value,
                                                        { fontSize: 9 },
                                                    ]}
                                                >
                                                    {Math.round(
                                                        field.omBalance
                                                            .degradation,
                                                    )}{" "}
                                                    kg/ha
                                                </Text>
                                            </View>
                                            <View
                                                style={{
                                                    flexDirection: "row",
                                                    justifyContent:
                                                        "space-between",
                                                    borderTopWidth: 1,
                                                    borderTopColor: "#f1f5f9",
                                                    paddingTop: 2,
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontSize: 8,
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    Balans
                                                </Text>
                                                <Text
                                                    style={[
                                                        pdfStyles.value,
                                                        {
                                                            fontSize: 9,
                                                            color:
                                                                field.omBalance
                                                                    .balance >=
                                                                0
                                                                    ? "#22c55e"
                                                                    : "#ef4444",
                                                        },
                                                    ]}
                                                >
                                                    {Math.round(
                                                        field.omBalance.balance,
                                                    )}{" "}
                                                    kg OS/ha
                                                </Text>
                                            </View>
                                        </View>
                                    </PdfCard>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={{ marginTop: 5 }} wrap={false}>
                        <SectionHeader>Gebruiksruimte (kg/ha)</SectionHeader>
                        <PdfCard>
                            <View style={pdfStyles.grid}>
                                <View
                                    style={{
                                        width: "33.33%",
                                        paddingRight: 10,
                                    }}
                                >
                                    <UsageBar
                                        label="Stikstof (N-w)"
                                        planned={field.normsFilling.nitrogen}
                                        limit={field.norms.nitrogen}
                                        unit="kg/ha"
                                    />
                                </View>
                                <View
                                    style={{
                                        width: "33.33%",
                                        paddingHorizontal: 5,
                                    }}
                                >
                                    <UsageBar
                                        label="Dierl. mest"
                                        planned={field.normsFilling.manure}
                                        limit={field.norms.manure}
                                        unit="kg/ha"
                                    />
                                </View>
                                <View
                                    style={{ width: "33.33%", paddingLeft: 10 }}
                                >
                                    <UsageBar
                                        label="Fosfaat"
                                        planned={field.normsFilling.phosphate}
                                        limit={field.norms.phosphate}
                                        unit="kg/ha"
                                    />
                                </View>
                            </View>
                        </PdfCard>
                    </View>

                    <View style={{ marginTop: 5 }}>
                        <SectionHeader>Bemestingsadvies</SectionHeader>

                        {/* Primary Nutrients */}
                        <View wrap={false}>
                            <Text
                                style={[
                                    pdfStyles.label,
                                    {
                                        marginBottom: 2,
                                        marginTop: 4,
                                        fontWeight: "bold",
                                    },
                                ]}
                            >
                                Hoofdelementen
                            </Text>
                            <PdfCard>
                                <View style={pdfStyles.grid}>
                                    {[
                                        {
                                            key: "nw",
                                            label: "Stikstof werkzaam (N-w)",
                                            unit: "kg/ha",
                                            factor: 1,
                                            plannedKey: "p_dose_nw",
                                            adviceKey: "d_n_req",
                                        },
                                        {
                                            key: "p2o5",
                                            label: "Fosfaat (P2O5)",
                                            unit: "kg/ha",
                                            factor: 1,
                                            plannedKey: "p_dose_p",
                                            adviceKey: "d_p_req",
                                        },
                                        {
                                            key: "k2o",
                                            label: "Kalium (K2O)",
                                            unit: "kg/ha",
                                            factor: 1,
                                            plannedKey: "p_dose_k",
                                            adviceKey: "d_k_req",
                                        },
                                    ].map((n, i) => (
                                        <View
                                            key={n.key}
                                            style={{
                                                width: "33.33%",
                                                paddingLeft:
                                                    i % 3 === 0 ? 0 : 5,
                                                paddingRight:
                                                    i % 3 === 2 ? 0 : 5,
                                            }}
                                        >
                                            <UsageBar
                                                label={n.label}
                                                planned={
                                                    (field.planned[
                                                        n.plannedKey as keyof typeof field.planned
                                                    ] || 0) * n.factor
                                                }
                                                limit={
                                                    (field.advice[
                                                        n.adviceKey as keyof typeof field.advice
                                                    ] || 0) * n.factor
                                                }
                                                unit={n.unit}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </PdfCard>
                        </View>

                        {/* Secondary Nutrients */}
                        <View wrap={false}>
                            <Text
                                style={[
                                    pdfStyles.label,
                                    {
                                        marginBottom: 2,
                                        marginTop: 6,
                                        fontWeight: "bold",
                                    },
                                ]}
                            >
                                Secundaire elementen
                            </Text>
                            <PdfCard>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        flexWrap: "wrap",
                                        marginHorizontal: -5,
                                    }}
                                >
                                    {[
                                        {
                                            key: "om",
                                            label: "Organische koolstof (EOC)",
                                            unit: "kg/ha",
                                            factor: 1,
                                            plannedKey: "p_dose_eoc",
                                            adviceKey: "d_c_req",
                                        },
                                        {
                                            key: "mg",
                                            label: "Magnesium (MgO)",
                                            unit: "kg/ha",
                                            factor: 1,
                                            plannedKey: "p_dose_mg",
                                            adviceKey: "d_mg_req",
                                        },
                                        {
                                            key: "s",
                                            label: "Zwavel (S)",
                                            unit: "kg/ha",
                                            factor: 1,
                                            plannedKey: "p_dose_s",
                                            adviceKey: "d_s_req",
                                        },
                                        {
                                            key: "ca",
                                            label: "Calcium (CaO)",
                                            unit: "kg/ha",
                                            factor: 1,
                                            plannedKey: "p_dose_ca",
                                            adviceKey: "d_ca_req",
                                        },
                                        {
                                            key: "na",
                                            label: "Natrium (Na2O)",
                                            unit: "kg/ha",
                                            factor: 1,
                                            plannedKey: "p_dose_na",
                                            adviceKey: "d_na_req",
                                        },
                                    ].map((n) => (
                                        <View
                                            key={n.key}
                                            style={{
                                                width: "33.33%",
                                                paddingHorizontal: 5,
                                                marginTop: 4,
                                                marginBottom: 4,
                                            }}
                                        >
                                            <UsageBar
                                                label={n.label}
                                                planned={
                                                    (field.planned[
                                                        n.plannedKey as keyof typeof field.planned
                                                    ] || 0) * n.factor
                                                }
                                                limit={
                                                    (field.advice[
                                                        n.adviceKey as keyof typeof field.advice
                                                    ] || 0) * n.factor
                                                }
                                                unit={n.unit}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </PdfCard>
                        </View>

                        {/* Trace Elements */}
                        <View wrap={false}>
                            <Text
                                style={[
                                    pdfStyles.label,
                                    {
                                        marginBottom: 2,
                                        marginTop: 6,
                                        fontWeight: "bold",
                                    },
                                ]}
                            >
                                Sporenelementen
                            </Text>
                            <PdfCard>
                                <View
                                    style={{
                                        flexDirection: "row",
                                        flexWrap: "wrap",
                                        marginHorizontal: -5,
                                    }}
                                >
                                    {[
                                        {
                                            key: "cu",
                                            label: "Koper (Cu)",
                                            unit: "g/ha",
                                            factor: 1000,
                                            plannedKey: "p_dose_cu",
                                            adviceKey: "d_cu_req",
                                        },
                                        {
                                            key: "zn",
                                            label: "Zink (Zn)",
                                            unit: "g/ha",
                                            factor: 1000,
                                            plannedKey: "p_dose_zn",
                                            adviceKey: "d_zn_req",
                                        },
                                        {
                                            key: "co",
                                            label: "Kobalt (Co)",
                                            unit: "g/ha",
                                            factor: 1000,
                                            plannedKey: "p_dose_co",
                                            adviceKey: "d_co_req",
                                        },
                                        {
                                            key: "mn",
                                            label: "Mangaan (Mn)",
                                            unit: "g/ha",
                                            factor: 1000,
                                            plannedKey: "p_dose_mn",
                                            adviceKey: "d_mn_req",
                                        },
                                        {
                                            key: "mo",
                                            label: "Molybdeen (Mo)",
                                            unit: "g/ha",
                                            factor: 1000,
                                            plannedKey: "p_dose_mo",
                                            adviceKey: "d_mo_req",
                                        },
                                        {
                                            key: "b",
                                            label: "Borium (B)",
                                            unit: "g/ha",
                                            factor: 1000,
                                            plannedKey: "p_dose_b",
                                            adviceKey: "d_b_req",
                                        },
                                    ].map((n) => (
                                        <View
                                            key={n.key}
                                            style={{
                                                width: "33.33%",
                                                paddingHorizontal: 5,
                                                marginTop: 4,
                                                marginBottom: 4,
                                            }}
                                        >
                                            <UsageBar
                                                label={n.label}
                                                planned={
                                                    (field.planned[
                                                        n.plannedKey as keyof typeof field.planned
                                                    ] || 0) * n.factor
                                                }
                                                limit={
                                                    (field.advice[
                                                        n.adviceKey as keyof typeof field.advice
                                                    ] || 0) * n.factor
                                                }
                                                unit={n.unit}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </PdfCard>
                        </View>
                    </View>

                    <View style={{ marginTop: 5 }} wrap={false}>
                        <SectionHeader>Geplande bemestingen</SectionHeader>
                        <PdfTable>
                            <PdfTableHeader>
                                <PdfTableCell weight={1.2}>
                                    <Text>Datum / product</Text>
                                </PdfTableCell>
                                <PdfTableCell weight={0.8}>
                                    <Text>Hoeveelheid (kg/ha)</Text>
                                </PdfTableCell>
                                <PdfTableCell>
                                    <Text>N tot. / w. (kg/ha)</Text>
                                </PdfTableCell>
                                <PdfTableCell>
                                    <Text>
                                        <Chemical symbol="P2O5" /> (kg/ha)
                                    </Text>
                                </PdfTableCell>
                                <PdfTableCell>
                                    <Text>
                                        <Chemical symbol="K2O" /> (kg/ha)
                                    </Text>
                                </PdfTableCell>
                            </PdfTableHeader>
                            {field.applications.length > 0 ? (
                                field.applications.map((app, idx) => (
                                    <PdfTableRow
                                        key={`${app.date}-${app.product}-${idx}`}
                                    >
                                        <PdfTableCell weight={1.2}>
                                            <Text>{app.date}</Text>
                                            <Text
                                                style={{
                                                    fontSize: 7,
                                                    color: "#64748b",
                                                }}
                                            >
                                                {app.product}
                                            </Text>
                                        </PdfTableCell>
                                        <PdfTableCell weight={0.8}>
                                            <Text>
                                                {Math.round(app.quantity)} kg/ha
                                            </Text>
                                        </PdfTableCell>
                                        <PdfTableCell>
                                            <Text>
                                                {Math.round(app.p_dose_n)} /{" "}
                                                {Math.round(app.p_dose_nw)}
                                            </Text>
                                        </PdfTableCell>
                                        <PdfTableCell>
                                            <Text>
                                                {Math.round(app.p_dose_p)}
                                            </Text>
                                        </PdfTableCell>
                                        <PdfTableCell>
                                            <Text>
                                                {Math.round(app.p_dose_k)}
                                            </Text>
                                        </PdfTableCell>
                                    </PdfTableRow>
                                ))
                            ) : (
                                <PdfTableRow>
                                    <PdfTableCell weight={5}>
                                        <Text>
                                            Geen geplande bemestingen gevonden.
                                        </Text>
                                    </PdfTableCell>
                                </PdfTableRow>
                            )}
                        </PdfTable>
                    </View>
                    <Footer config={data.config} />
                </Page>
            ))}

        {/* Bufferstrips Section */}
        {data.fields.some((f) => f.isBufferstrip) && (
            <Page size="A4" style={pdfStyles.page} id="bufferstrips">
                <View style={pdfStyles.header}>
                    <Text style={pdfStyles.title}>Bufferstroken</Text>
                    <View style={{ alignItems: "flex-end" }}>
                        {data.config.logo ? (
                            <Image
                                src={data.config.logo}
                                style={pdfStyles.logo}
                            />
                        ) : (
                            <Text
                                style={{
                                    fontSize: 18,
                                    fontWeight: "bold",
                                    color: "#0f172a",
                                }}
                            >
                                {data.config.name}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={{ marginTop: 20 }}>
                    <PdfTable>
                        <PdfTableHeader>
                            <PdfTableCell weight={2}>
                                <Text>Bufferstrook</Text>
                            </PdfTableCell>
                            <PdfTableCell weight={1}>
                                <Text>Opp (ha)</Text>
                            </PdfTableCell>
                            <PdfTableCell weight={2}>
                                <Text>Hoofdteelt</Text>
                            </PdfTableCell>
                            <PdfTableCell weight={3}>
                                <Text>Opmerkingen</Text>
                            </PdfTableCell>
                        </PdfTableHeader>
                        {data.fields
                            .filter((f) => f.isBufferstrip)
                            .map((field) => (
                                <PdfTableRow key={field.id}>
                                    <PdfTableCell weight={2}>
                                        <Text style={{ fontWeight: "bold" }}>
                                            {field.name}
                                        </Text>
                                    </PdfTableCell>
                                    <PdfTableCell weight={1}>
                                        <Text>{field.area.toFixed(3)}</Text>
                                    </PdfTableCell>
                                    <PdfTableCell weight={2}>
                                        <Text>{field.mainCrop}</Text>
                                    </PdfTableCell>
                                    <PdfTableCell weight={3}>
                                        {field.applications.length > 0 ? (
                                            <Text
                                                style={{
                                                    color: "#ef4444",
                                                    fontWeight: "bold",
                                                }}
                                            >
                                                Waarschuwing: bemesting op
                                                bufferstrook!
                                            </Text>
                                        ) : (
                                            <Text style={{ color: "#64748b" }}>
                                                -
                                            </Text>
                                        )}
                                    </PdfTableCell>
                                </PdfTableRow>
                            ))}
                    </PdfTable>
                </View>
                <Footer config={data.config} />
            </Page>
        )}
    </Document>
)
