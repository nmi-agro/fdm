import type { TicketFilters } from "@nmi-agro/fdm-helpdesk"
import { type Dispatch, type SetStateAction, useMemo } from "react"
import { AutoComplete } from "~/components/custom/autocomplete"
import { DatePicker } from "~/components/custom/date-picker-v2"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Field, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Button } from "../../ui/button"
import { ChevronDown, User, Users } from "lucide-react"

type FilterCommon<T> = { name: keyof T; label: string }
type FilterConfig =
    | { type: "text" }
    | { type: "date" }
    | { type: "principal" }
    | { type: "agent" }
    | { type: "enum"; options: { value: string; label: string }[] }

type FilterConfigArray<T> = (FilterCommon<T> & FilterConfig)[]

/**
 * Gets the memoized ticket search filter config according to whether the viewer is an agent or not
 * @param isAgent
 * @returns
 */
export function useTicketFilterConfig(
    isAgent: boolean,
): FilterConfigArray<TicketFilters> {
    return useMemo(() => {
        const common: FilterConfigArray<TicketFilters> = [
            {
                name: "fromDate",
                label: "Vanaf",
                type: "date",
            },
            {
                name: "toDate",
                label: "Tot en met",
                type: "date",
            },
        ]
        if (isAgent) {
            return [
                ...common,
                {
                    name: "requesterIds",
                    label: "Aangevraagd door",
                    type: "principal",
                },
                {
                    name: "assignees",
                    label: "Toegewezen aan",
                    type: "agent",
                },
                {
                    name: "minPriority",
                    label: "Prioriteit",
                    type: "enum",
                    options: [
                        { value: "low", label: "Laag" },
                        { value: "normal", label: "Normaal" },
                        { value: "high", label: "Hoog" },
                        { value: "urgent", label: "Urgent" },
                    ],
                },
            ]
        }

        return common
    }, [isAgent])
}

/**
 * A component that can adjust a set of TicketFilters
 *
 * More filters are available if `isAgent` is true
 */
export function TicketSearch({
    filters,
    setFilters,
    isAgent,
}: {
    filters: TicketFilters
    setFilters: Dispatch<SetStateAction<TicketFilters>>
    isAgent: boolean
}) {
    const filterConfig = useTicketFilterConfig(isAgent)

    return (
        <SearchFields<TicketFilters>
            filterConfig={filterConfig}
            filters={filters}
            setFilters={(incomingFilters) => {
                const nextFilters =
                    typeof incomingFilters === "function"
                        ? incomingFilters(filters)
                        : incomingFilters
                // Set maxFilters the same as minFilters
                setFilters({
                    ...nextFilters,
                    minPriority: nextFilters.minPriority,
                    maxPriority: nextFilters.minPriority,
                })
            }}
        />
    )
}

export function SearchFields<
    T extends {
        [k: string]: any
    },
>({
    filterConfig,
    filters,
    setFilters,
}: {
    filterConfig: FilterConfigArray<T>
    filters: T
    setFilters: Dispatch<SetStateAction<T>>
}) {
    const setFiltersThrottled = setFilters // TODO: Must be similar to what Autocomplete does

    // Define icon map for AutoComplete
    const iconMap = { user: User, organization: Users }

    return (
        <div className="space-y-4">
            {filterConfig.map((field) => {
                if (field.type === "date") {
                    return (
                        <Field className="space-y-0">
                            <FieldLabel className="text-sm text-muted-foreground">
                                {field.label}
                            </FieldLabel>
                            <DatePicker
                                key={field.name as string}
                                label={undefined}
                                field={{
                                    onChange: (...event: any[]): void => {
                                        setFiltersThrottled({
                                            ...filters,
                                            [field.name]: event[0],
                                        })
                                    },
                                    onBlur: (): void => {},
                                    value: filters[field.name],
                                    disabled: false,
                                    name: field.name as string,
                                    ref: (
                                        _instance: HTMLInputElement,
                                    ): void => {},
                                }}
                                fieldState={{
                                    invalid: false,
                                    isTouched: false,
                                    isDirty: false,
                                    isValidating: false,
                                    error: undefined,
                                }}
                            />
                        </Field>
                    )
                }

                if (field.type === "principal") {
                    return (
                        <Field key={field.name as string} className="space-y-0">
                            <FieldLabel className="text-sm text-muted-foreground">
                                {field.label}
                            </FieldLabel>
                            <AutoComplete
                                lookupUrl="/api/lookup/principal?principal_id"
                                iconMap={iconMap}
                                selectedValue={
                                    filters[field.name]?.length > 0
                                        ? filters[field.name][0]
                                        : undefined
                                }
                                onSelectedValueChange={(value) =>
                                    setFiltersThrottled({
                                        ...filters,
                                        [field.name]: [value],
                                    })
                                }
                                emptyMessage="Geen gebruikers gevonden."
                                placeholder="Zoek naar een gebruiker of organisatie"
                                allowValuesOutsideList={false}
                                name={field.name as string} // Name for remix-hook-form registration
                            />
                        </Field>
                    )
                }

                if (field.type === "agent") {
                    return (
                        <Field key={field.name as string} className="space-y-0">
                            <FieldLabel className="text-sm text-muted-foreground">
                                {field.label}
                            </FieldLabel>
                            <AutoComplete
                                selectedValue={
                                    filters[field.name]?.length > 0
                                        ? filters[field.name][0]
                                        : undefined
                                }
                                onSelectedValueChange={(value: string) => {
                                    setFiltersThrottled({
                                        ...filters,
                                        [field.name]: [value],
                                    })
                                }}
                                allowValuesOutsideList={false}
                                lookupUrl={"/api/lookup/agent?principal_id"}
                            />
                        </Field>
                    )
                }

                if (field.type === "enum") {
                    return (
                        <Field key={field.name as string} className="space-y-0">
                            <FieldLabel className="text-sm text-muted-foreground">
                                {field.label}
                            </FieldLabel>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="justify-between font-medium"
                                    >
                                        {field.options.find(
                                            (item) =>
                                                item.value ===
                                                filters[field.name],
                                        )?.label ?? ""}
                                        <ChevronDown className="size-3 opacity-50 ms-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {field.options.map((item) => (
                                        <DropdownMenuCheckboxItem
                                            key={item.value}
                                            checked={
                                                item.value ===
                                                filters[field.name]
                                            }
                                            onClick={() => {
                                                if (
                                                    item.value ===
                                                    filters[field.name]
                                                ) {
                                                    const {
                                                        [field.name]: _removed,
                                                        ...newFilters
                                                    } = filters
                                                    setFiltersThrottled(
                                                        newFilters as T,
                                                    )
                                                } else {
                                                    setFiltersThrottled({
                                                        ...filters,
                                                        [field.name]:
                                                            item.value,
                                                    })
                                                }
                                            }}
                                        >
                                            {item.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Field>
                    )
                }

                return (
                    <Field key={field.name as string} className="space-y-0">
                        <FieldLabel className="text-sm text-muted-foreground">
                            {field.label}
                        </FieldLabel>
                        <Input type="text" value={filters[field.name] ?? ""} />
                    </Field>
                )
            })}
        </div>
    )
}
