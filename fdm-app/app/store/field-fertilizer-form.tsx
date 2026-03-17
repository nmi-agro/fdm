import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { FieldFertilizerFormValues } from "~/components/blocks/fertilizer-applications/formschema"

interface FieldFertilizerFormStore {
    db: Record<string, Partial<FieldFertilizerFormValues>>
    save(
        b_id_farm: string,
        b_id_or_b_lu_catalogue: string,
        formData: Partial<FieldFertilizerFormValues>,
        calendar?: string,
    ): void
    load(
        b_id_farm: string,
        b_id_or_b_lu_catalogue: string,
        calendar?: string,
    ): Partial<FieldFertilizerFormValues> | undefined
    delete(b_id_farm: string, b_id_or_b_lu_catalogue: string, calendar?: string): void
}

function makeId(b_id_farm: string, b_id: string, calendar?: string) {
    return calendar ? `${b_id_farm}/${b_id}/${calendar}` : `${b_id_farm}/${b_id}`
}
export const useFieldFertilizerFormStore = create<FieldFertilizerFormStore>()(
    persist(
        (set, get) => ({
            db: {},
            save(b_id_farm, b_id_or_b_lu_catalogue, formData, calendar) {
                const db = {
                    ...get().db,
                    [makeId(b_id_farm, b_id_or_b_lu_catalogue, calendar)]: formData,
                }
                set({ db })
            },
            load(b_id_farm, b_id_or_b_lu_catalogue, calendar) {
                return get().db[makeId(b_id_farm, b_id_or_b_lu_catalogue, calendar)]
            },
            delete(b_id_farm, b_id_or_b_lu_catalogue, calendar) {
                const db = { ...get().db }
                delete db[makeId(b_id_farm, b_id_or_b_lu_catalogue, calendar)]
                set({ db })
            },
        }),
        {
            name: "field-fertilizer-form", // name of the item in the storage (must be unique)
            storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
        },
    ),
)
