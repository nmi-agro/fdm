import { motion } from "framer-motion"
import { Card } from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"

export function MijnPercelenUploadAnimation({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="relative w-full max-w-lg mx-auto">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 rounded-md" />
            <div className="relative z-0">{children}</div>
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="p-6 text-center space-y-4">
                        <Spinner className="mx-auto w-8 h-8 text-muted-foreground" />
                        <h3 className="font-semibold text-muted-foreground">
                            Percelen verwerken...
                        </h3>
                    </Card>
                </motion.div>
            </div>
        </div>
    )
}
