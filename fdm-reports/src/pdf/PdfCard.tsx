import { View } from "@react-pdf/renderer"
import { pdfStyles } from "../fertilizer-plan/pdf/styles"

export const PdfCard = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[pdfStyles.card, style]}>{children}</View>
)
