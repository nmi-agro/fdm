import { StyleSheet } from "@react-pdf/renderer"

// Use standard PDF fonts for maximum compatibility and to avoid registration errors
const fontFamily = "Helvetica"

export const pdfStyles = StyleSheet.create({
    page: {
        paddingTop: 40,
        paddingHorizontal: 40,
        paddingBottom: 80,
        fontFamily: fontFamily,
        fontSize: 10,
        lineHeight: 1.5,
        color: "#020617",
        backgroundColor: "#FFFFFF",
    },
    // Front Page Styles
    frontPage: {
        padding: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#122023", // Landing page dark theme
        overflow: "hidden",
    },
    frontHeader: {
        padding: 60,
        paddingTop: 80,
    },
    frontLogo: {
        width: 180,
        marginBottom: 60,
    },
    frontTitleContainer: {
        marginTop: 40,
    },
    frontTitle: {
        fontSize: 56,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginBottom: 10,
        letterSpacing: -1,
    },
    frontSubtitle: {
        fontSize: 28,
        color: "#94a3b8",
        marginBottom: 40,
    },
    frontFooter: {
        backgroundColor: "#1e293b",
        padding: 60,
        color: "#f8fafc",
        borderTopWidth: 1,
        borderTopColor: "#334155",
    },
    frontFarmName: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 8,
        color: "#FFFFFF",
    },
    // ... rest of frontInfo

    frontInfo: {
        fontSize: 12,
        opacity: 0.8,
    },
    // Standard Layout Styles
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
        paddingBottom: 10,
    },
    miniHeader: {
        position: "absolute",
        top: 20,
        right: 40,
        fontSize: 7,
        color: "#94a3b8",
    },
    logo: {
        width: 60,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "bold",
        marginTop: 20,
        marginBottom: 10,
        color: "#0f172a",
        borderLeftWidth: 3,
        borderLeftColor: "#3b82f6",
        paddingLeft: 8,
    },
    card: {
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        backgroundColor: "#ffffff",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginHorizontal: -5,
    },
    gridCol: {
        paddingHorizontal: 5,
        marginBottom: 10,
    },
    label: {
        color: "#64748b",
        fontSize: 8,
        textTransform: "uppercase",
        marginBottom: 2,
        letterSpacing: 0.5,
    },
    value: {
        fontWeight: "bold",
        fontSize: 11,
    },
    badge: {
        backgroundColor: "#f1f5f9",
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 10,
        fontSize: 8,
        alignSelf: "flex-start",
    },
    table: {
        marginTop: 10,
        borderRadius: 8,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f8fafc",
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
    },
    tableCell: {
        padding: 8,
        flex: 1,
    },
    footer: {
        position: "absolute",
        top: 780,
        left: 40,
        right: 40,
        flexDirection: "row",
        justifyContent: "space-between",
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
        paddingTop: 10,
        fontSize: 8,
        color: "#64748b",
    },
})
