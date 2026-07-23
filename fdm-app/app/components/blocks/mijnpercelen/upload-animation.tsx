import { motion } from "framer-motion"
import { Card } from "~/components/ui/card"
import { Spinner } from "~/components/ui/spinner"

export function MijnPercelenUploadAnimation({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="bg-background/80 absolute inset-0 z-10 rounded-md backdrop-blur-sm" />
      <div className="relative z-0">{children}</div>
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="space-y-4 p-6 text-center">
            <Spinner className="text-muted-foreground mx-auto h-8 w-8" />
            <h3 className="text-muted-foreground font-semibold">Percelen verwerken...</h3>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
