import { View } from "@react-pdf/renderer"
import { pdfStyles } from "./bemestingsplan/styles"

export const PdfCard = ({
    children,
    style,
}: {
    children: React.ReactNode
    style?: any
}) => <View style={[pdfStyles.card, style]}>{children}</View>
