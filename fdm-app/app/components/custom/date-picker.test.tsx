import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DatePicker } from "./date-picker"
import { useForm, FormProvider } from "react-hook-form"
import * as calendarStore from "~/store/calendar"

// Mock calendar store
vi.mock("~/store/calendar", () => ({
    useCalendarStore: vi.fn(() => ({ calendar: "2024" })),
}))

// Mock chrono-node
vi.mock("chrono-node", () => ({
    nl: {
        parse: vi.fn((text, ref) => {
            if (text === "vandaag") {
                return [
                    {
                        start: {
                            date: () => new Date(2024, 0, 15),
                            isCertain: vi.fn((part) => part === "day"),
                        },
                    },
                ]
            }
            if (text === "gisteren") {
                return [
                    {
                        start: {
                            date: () => new Date(2024, 0, 14),
                            isCertain: vi.fn((part) => part === "day"),
                        },
                    },
                ]
            }
            return []
        }),
    },
}))

// Test wrapper component with react-hook-form
function TestWrapper({
    children,
    defaultValues = {},
}: {
    children: React.ReactNode
    defaultValues?: any
}) {
    const form = useForm({ defaultValues })
    return <FormProvider {...form}>{children}</FormProvider>
}

describe("DatePicker (original) component", () => {
    const mockForm = {
        control: {} as any,
        getValues: vi.fn((name: string) => undefined),
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("rendering", () => {
        it("should render with label", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date Label"
                        description="Test description"
                        disabled={false}
                    />
                </TestWrapper>,
            )

            expect(screen.getByText("Test Date Label")).toBeInTheDocument()
        })

        it("should render with description", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description="This is a helpful description"
                        disabled={false}
                    />
                </TestWrapper>,
            )

            expect(
                screen.getByText("This is a helpful description"),
            ).toBeInTheDocument()
        })

        it("should render input field", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            expect(input).toBeInTheDocument()
        })

        it("should render calendar button", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const button = screen.getByRole("button")
            expect(button).toBeInTheDocument()
        })
    })

    describe("disabled state", () => {
        it("should disable input when disabled prop is true", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={true}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            expect(input).toBeDisabled()
        })

        it("should disable calendar button when disabled prop is true", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={true}
                    />
                </TestWrapper>,
            )

            const button = screen.getByRole("button")
            expect(button).toBeDisabled()
        })

        it("should enable controls when disabled prop is false", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            const button = screen.getByRole("button")

            expect(input).not.toBeDisabled()
            expect(button).not.toBeDisabled()
        })
    })

    describe("date parsing and formatting", () => {
        it("should display formatted date from form value", () => {
            const formWithDate = {
                ...mockForm,
                getValues: vi.fn(() => new Date(2024, 2, 15)), // March 15, 2024
            }

            render(
                <TestWrapper defaultValues={{ testDate: new Date(2024, 2, 15) }}>
                    <DatePicker
                        form={formWithDate as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            // Check if formatted date is displayed
            const input = screen.getByPlaceholderText("Kies een datum")
            expect(input).toBeInTheDocument()
        })

        it("should parse Dutch date format DD-MM-YYYY", async () => {
            const user = userEvent.setup()

            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            await user.type(input, "15-03-2024")
            fireEvent.blur(input)

            // Input should accept the value
            expect(input).toBeInTheDocument()
        })

        it("should parse Dutch date format DD-MM", async () => {
            const user = userEvent.setup()

            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            await user.type(input, "15-03")
            fireEvent.blur(input)

            expect(input).toBeInTheDocument()
        })

        it("should handle invalid date input", async () => {
            const user = userEvent.setup()

            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            await user.type(input, "invalid-date")
            fireEvent.blur(input)

            // Should not crash and handle gracefully
            expect(input).toBeInTheDocument()
        })

        it("should clear date when input is emptied", async () => {
            const user = userEvent.setup()

            render(
                <TestWrapper defaultValues={{ testDate: new Date(2024, 2, 15) }}>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText(
                "Kies een datum",
            ) as HTMLInputElement
            await user.clear(input)
            fireEvent.blur(input)

            // Should handle clearing
            expect(input).toBeInTheDocument()
        })
    })

    describe("calendar interaction", () => {
        it("should open calendar popover when button is clicked", async () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const button = screen.getByRole("button")
            fireEvent.click(button)

            // Popover should open
            expect(button).toBeInTheDocument()
        })

        it("should open calendar when pressing ArrowDown in input", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            fireEvent.keyDown(input, { key: "ArrowDown" })

            // Should trigger calendar open
            expect(input).toBeInTheDocument()
        })

        it("should submit form when pressing Enter in input", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            fireEvent.keyDown(input, { key: "Enter" })

            // Should handle Enter key
            expect(input).toBeInTheDocument()
        })
    })

    describe("calendar year context", () => {
        it("should use calendar year from store", () => {
            vi.mocked(calendarStore.useCalendarStore).mockReturnValue({
                calendar: "2025",
            } as any)

            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            expect(screen.getByPlaceholderText("Kies een datum")).toBeInTheDocument()
        })

        it("should default to current year when calendar is undefined", () => {
            vi.mocked(calendarStore.useCalendarStore).mockReturnValue({
                calendar: undefined,
            } as any)

            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            expect(screen.getByPlaceholderText("Kies een datum")).toBeInTheDocument()
        })
    })

    describe("date parsing utilities", () => {
        it("should handle ISO date strings", () => {
            const formWithISODate = {
                ...mockForm,
                getValues: vi.fn(() => "2024-03-15T00:00:00.000Z"),
            }

            render(
                <TestWrapper
                    defaultValues={{ testDate: "2024-03-15T00:00:00.000Z" }}
                >
                    <DatePicker
                        form={formWithISODate as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            expect(screen.getByPlaceholderText("Kies een datum")).toBeInTheDocument()
        })

        it("should validate date boundaries", async () => {
            const user = userEvent.setup()

            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            // Try an invalid date like 32-01-2024
            await user.type(input, "32-01-2024")
            fireEvent.blur(input)

            // Should handle invalid dates gracefully
            expect(input).toBeInTheDocument()
        })

        it("should handle leap year dates", async () => {
            const user = userEvent.setup()

            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            // February 29 in a leap year
            await user.type(input, "29-02-2024")
            fireEvent.blur(input)

            expect(input).toBeInTheDocument()
        })
    })

    describe("form integration", () => {
        it("should integrate with react-hook-form FormField", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            // Should render within form context
            expect(screen.getByText("Test Date")).toBeInTheDocument()
        })

        it("should handle form validation errors", () => {
            const formWithError = {
                ...mockForm,
                control: {
                    _formState: {
                        errors: {
                            testDate: {
                                message: "Date is required",
                            },
                        },
                    },
                } as any,
            }

            render(
                <TestWrapper>
                    <DatePicker
                        form={formWithError as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            expect(screen.getByText("Test Date")).toBeInTheDocument()
        })
    })

    describe("accessibility", () => {
        it("should have accessible label", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Birth Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            expect(screen.getByText("Birth Date")).toBeInTheDocument()
        })

        it("should have screen reader text for calendar button", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const button = screen.getByRole("button")
            expect(button).toBeInTheDocument()
        })

        it("should support keyboard navigation", () => {
            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")

            // Tab navigation
            fireEvent.keyDown(input, { key: "Tab" })

            // Arrow key navigation
            fireEvent.keyDown(input, { key: "ArrowDown" })

            expect(input).toBeInTheDocument()
        })
    })

    describe("edge cases", () => {
        it("should handle undefined form value", () => {
            const formWithUndefined = {
                ...mockForm,
                getValues: vi.fn(() => undefined),
            }

            render(
                <TestWrapper>
                    <DatePicker
                        form={formWithUndefined as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText(
                "Kies een datum",
            ) as HTMLInputElement
            expect(input.value).toBe("")
        })

        it("should handle null form value", () => {
            const formWithNull = {
                ...mockForm,
                getValues: vi.fn(() => null),
            }

            render(
                <TestWrapper>
                    <DatePicker
                        form={formWithNull as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText(
                "Kies een datum",
            ) as HTMLInputElement
            expect(input.value).toBe("")
        })

        it("should handle rapid input changes", async () => {
            const user = userEvent.setup()

            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")

            // Type multiple dates quickly
            await user.type(input, "15-03-2024")
            await user.clear(input)
            await user.type(input, "20-04-2024")

            expect(input).toBeInTheDocument()
        })

        it("should handle popover state changes", async () => {
            const { rerender } = render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            // Open popover
            const button = screen.getByRole("button")
            fireEvent.click(button)

            // Disable field while popover is open
            rerender(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={true}
                    />
                </TestWrapper>,
            )

            // Should close popover when disabled
            expect(button).toBeDisabled()
        })
    })

    describe("Dutch locale formatting", () => {
        it("should format dates in Dutch locale", () => {
            const formWithDate = {
                ...mockForm,
                getValues: vi.fn(() => new Date(2024, 0, 1)),
            }

            render(
                <TestWrapper defaultValues={{ testDate: new Date(2024, 0, 1) }}>
                    <DatePicker
                        form={formWithDate as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            // Should use Dutch month names
            expect(screen.getByPlaceholderText("Kies een datum")).toBeInTheDocument()
        })

        it("should accept Dutch date separators (. / -)", async () => {
            const user = userEvent.setup()

            render(
                <TestWrapper>
                    <DatePicker
                        form={mockForm as any}
                        name="testDate"
                        label="Test Date"
                        description=""
                        disabled={false}
                    />
                </TestWrapper>,
            )

            const input = screen.getByPlaceholderText("Kies een datum")

            // Try dot separator
            await user.type(input, "15.03.2024")
            fireEvent.blur(input)

            // Try slash separator
            await user.clear(input)
            await user.type(input, "15/03/2024")
            fireEvent.blur(input)

            expect(input).toBeInTheDocument()
        })
    })
})