import type { TagSummary, TicketFilters } from "@nmi-agro/fdm-helpdesk"
import { ChevronDown, User, Users } from "lucide-react"
import { type ReactNode, useMemo } from "react"
import { AutoComplete } from "~/components/custom/autocomplete"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Field, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { TagSelector } from "./tag-selector"

type FilterCommon<T> = { name: keyof T; label: string }
type FilterConfig<T> =
    | { type: "text" }
    | { type: "date" }
    | { type: "principal" }
    | { type: "agent" }
    | {
          type: "enum"
          options: EnumOption[]
      }
    | {
          type: "custom"
          render: (props: {
              filters: T
              setFilters: (value: any) => void
          }) => ReactNode
      }
type EnumOption = { value: string; label: string; icon?: ReactNode }

type FilterConfigArray<T> = (FilterCommon<T> & FilterConfig<T>)[]

/**
 * Gets the memoized ticket search filter config according to whether the viewer is an agent or not
 * @param isAgent
 * @returns
 */
export function useTicketFilterConfig(
    isAgent: boolean,
    availableTags: TagSummary[],
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
            {
                name: "tags",
                label: "Tags",
                type: "custom",
                render: ({ filters, setFilters }) => (
                    <TagSelector
                        availableTags={availableTags}
                        value={filters.tags ?? []}
                        setValue={(tags) => {
                            setFilters({ ...filters, tags: tags })
                        }}
                        disabled={false}
                        canModify={true}
                        canClear={true}
                        canCreateTag={false}
                        onCreateTag={undefined}
                    />
                ),
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
    }, [isAgent, availableTags])
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
    availableTags,
}: {
    filters: TicketFilters
    setFilters: (filters: TicketFilters) => void
    isAgent: boolean
    availableTags: TagSummary[]
}) {
    const filterConfig = useTicketFilterConfig(isAgent, availableTags)

    return (
        <SearchFields<TicketFilters>
            filterConfig={filterConfig}
            filters={filters}
            setFilters={(nextFilters) => {
                // Mirror minPriority -> maxPriority so the range filter works
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
    setFilters: (filters: T) => void
}) {
    // Define icon map for AutoComplete
    const iconMap = { user: User, organization: Users }

    return (
        <div className="space-y-4">
            {filterConfig.map((field) => {
                if (field.type === "date") {
                    return (
                        <Field key={field.name as string} className="space-y-0">
                            <FieldLabel className="text-sm text-muted-foreground">
                                {field.label}
                            </FieldLabel>
                            <DatePicker
                                label={undefined}
                                field={{
                                    onChange: (...event: any[]): void => {
                                        setFilters({
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
                                    setFilters({
                                        ...filters,
                                        [field.name]: value
                                            ? [value]
                                            : undefined,
                                    })
                                }
                                emptyMessage="Geen gebruikers gevonden."
                                placeholder="Zoek naar een gebruiker of organisatie"
                                allowValuesOutsideList={false}
                                name={field.name as string}
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
                                onSelectedValueChange={(value) => {
                                    setFilters({
                                        ...filters,
                                        [field.name]: value
                                            ? [value]
                                            : undefined,
                                    })
                                }}
                                allowValuesOutsideList={false}
                                lookupUrl={"/api/lookup/agent?principal_id"}
                                iconMap={iconMap}
                                placeholder="Zoek naar een medewerker"
                                emptyMessage="Geen medewerkers gevonden."
                            />
                        </Field>
                    )
                }

                if (field.type === "enum") {
                    const activeOption = field.options.find(
                        (item) => item.value === filters[field.name],
                    )
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
                                        className="justify-between font-medium w-full"
                                    >
                                        <span
                                            className={
                                                activeOption
                                                    ? undefined
                                                    : "text-muted-foreground"
                                            }
                                        >
                                            {activeOption?.label ??
                                                "Alle prioriteiten"}
                                        </span>
                                        <ChevronDown className="size-3 opacity-50 ms-1" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {activeOption && (
                                        <DropdownMenuItem
                                            onSelect={() => {
                                                const {
                                                    [field.name]: _removed,
                                                    ...newFilters
                                                } = filters
                                                setFilters(newFilters as T)
                                            }}
                                            className="text-muted-foreground"
                                        >
                                            Wis filter
                                        </DropdownMenuItem>
                                    )}
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
                                                    setFilters(newFilters as T)
                                                } else {
                                                    setFilters({
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

                if (field.type === "custom") {
                    return (
                        <Field key={field.name as string}>
                            <FieldLabel className="text-sm text-muted-foreground">
                                {field.label}
                            </FieldLabel>
                            {field.render({
                                filters: filters,
                                setFilters: setFilters,
                            })}
                        </Field>
                    )
                }

                return (
                    <Field key={field.name as string} className="space-y-0">
                        <FieldLabel className="text-sm text-muted-foreground">
                            {field.label}
                        </FieldLabel>
                        <Input
                            type="text"
                            value={filters[field.name] ?? ""}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    [field.name]: e.target.value || undefined,
                                })
                            }
                        />
                    </Field>
                )
            })}
        </div>
    )
}
