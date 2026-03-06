import { create } from "zustand"

export const useActiveTableFormStore = create<{
    activeForm: string | null
    clearActiveForm(): void
    setActiveForm(id: string): void
}>((set) => ({
    activeForm: null,
    setActiveForm(id) {
        set({ activeForm: id })
    },
    clearActiveForm() {
        set({ activeForm: null })
    },
}))
