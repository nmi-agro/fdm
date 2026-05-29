interface WizardProgressProps {
    currentStep: number
    totalSteps: number
    stepLabel: string
}

/**
 * Progress bar header for the BCS wizard.
 * Shows current step number, label, and a progress bar.
 */
export function WizardProgress({ currentStep, totalSteps, stepLabel }: WizardProgressProps) {
    const progressValue = ((currentStep + 1) / totalSteps) * 100

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                    Stap {currentStep + 1} van {totalSteps}
                </span>
                <span>{stepLabel}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progressValue}%` }}
                />
            </div>
        </div>
    )
}
