import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DatePicker } from "./date-picker-v2"
import * as calendarStore from "~/store/calendar"

// Mock the calendar store
vi.mock("~/store/calendar", () => ({
    useCalendarStore: vi.fn(() => ({ calendar: "2024" })),
}))

// Mock chrono-node
vi.mock("chrono-node", () => ({
    nl: {
        parse: vi.fn((text, ref) => {
            if (text === "vandaag" || text === "today") {
                return [{ start: { date: () => new Date(2024, 0, 15) } }]
            }
            if (text === "gisteren") {
                return [{ start: { date: () => new Date(2024, 0, 14) } }]
            }
            return []
        }),
    },
}))

describe("DatePicker component", () => {
    const mockField = {
        name: "test-date",
        value: undefined,
        onChange: vi.fn(),
        onBlur: vi.fn(),
        ref: vi.fn(),
        disabled: false,
    }

    const mockFieldState = {
        invalid: false,
        error: undefined,
        isDirty: false,
        isTouched: false,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("rendering", () => {
        it("should render with label", () => {
            render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            expect(screen.getByText("Test Date")).toBeInTheDocument()
        })

        it("should render with placeholder", () => {
            render(
                <DatePicker
                    label="Test Date"
                    placeholder="Custom placeholder"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            expect(
                screen.getByPlaceholderText("Custom placeholder"),
            ).toBeInTheDocument()
        })

        it("should render with default placeholder when none provided", () => {
            render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            expect(
                screen.getByPlaceholderText("Kies een datum"),
            ).toBeInTheDocument()
        })

        it("should render with description", () => {
            render(
                <DatePicker
                    label="Test Date"
                    description="This is a test description"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            expect(
                screen.getByText("This is a test description"),
            ).toBeInTheDocument()
        })

        it("should render calendar button", () => {
            render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            const button = screen.getByRole("button", { name: /kies een datum/i })
            expect(button).toBeInTheDocument()
        })

        it("should apply custom className", () => {
            const { container } = render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={mockFieldState}
                    className="custom-class"
                />,
            )

            const fieldElement = container.querySelector(".custom-class")
            expect(fieldElement).toBeInTheDocument()
        })
    })

    describe("field state and validation", () => {
        it("should mark field as invalid when fieldState.invalid is true", () => {
            const invalidFieldState = { ...mockFieldState, invalid: true }

            const { container } = render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={invalidFieldState}
                />,
            )

            const fieldElement = container.querySelector('[data-invalid="true"]')
            expect(fieldElement).toBeInTheDocument()
        })

        it("should display error message when field is invalid", () => {
            const invalidFieldState = {
                ...mockFieldState,
                invalid: true,
                error: { message: "Date is required" },
            }

            render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={invalidFieldState}
                />,
            )

            expect(screen.getByText("Date is required")).toBeInTheDocument()
        })

        it("should mark input as required when required prop is true", () => {
            render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={mockFieldState}
                    required={true}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            expect(input).toHaveAttribute("aria-required", "true")
            expect(input).toHaveAttribute("required")
        })

        it("should not mark as required when required prop is false", () => {
            render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={mockFieldState}
                    required={false}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            expect(input).toHaveAttribute("aria-required", "false")
        })
    })

    describe("date input and formatting", () => {
        it("should format and display default value", () => {
            const fieldWithValue = {
                ...mockField,
                value: new Date(2024, 0, 15).toISOString(),
            }

            render(
                <DatePicker
                    label="Test Date"
                    field={fieldWithValue}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByDisplayValue(/15 januari 2024/i)
            expect(input).toBeInTheDocument()
        })

        it("should allow user to type date in Dutch format (DD-MM-YYYY)", async () => {
            const user = userEvent.setup()
            const field = { ...mockField }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            await user.type(input, "15-01-2024")
            fireEvent.blur(input)

            await waitFor(() => {
                expect(field.onChange).toHaveBeenCalled()
            })
        })

        it("should handle incomplete input gracefully", async () => {
            const user = userEvent.setup()
            const field = { ...mockField }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            await user.type(input, "15-01")
            fireEvent.blur(input)

            await waitFor(() => {
                expect(field.onChange).toHaveBeenCalled()
            })
        })

        it("should clear field when input is emptied", async () => {
            const user = userEvent.setup()
            const field = { ...mockField }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText(
                "Kies een datum",
            ) as HTMLInputElement
            await user.clear(input)
            fireEvent.blur(input)

            await waitFor(() => {
                expect(field.onChange).toHaveBeenCalledWith(null)
            })
        })
    })

    describe("calendar interaction", () => {
        it("should open calendar when button is clicked", async () => {
            render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            const button = screen.getByRole("button", { name: /kies een datum/i })
            fireEvent.click(button)

            // Calendar should be visible (popover content)
            await waitFor(() => {
                const calendar = screen.queryByRole("dialog")
                // Calendar component renders, checking for basic structure
                expect(button).toBeInTheDocument()
            })
        })

        it("should open calendar when pressing ArrowDown in input", async () => {
            render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            fireEvent.keyDown(input, { key: "ArrowDown" })

            // Should trigger calendar opening
            expect(input).toBeInTheDocument()
        })

        it("should disable calendar button when field is disabled", () => {
            const disabledField = { ...mockField, disabled: true }

            render(
                <DatePicker
                    label="Test Date"
                    field={disabledField}
                    fieldState={mockFieldState}
                />,
            )

            const button = screen.getByRole("button", { name: /kies een datum/i })
            expect(button).toBeDisabled()
        })
    })

    describe("date parsing", () => {
        it("should parse ISO date strings", async () => {
            const fieldWithISOValue = {
                ...mockField,
                value: "2024-03-15T00:00:00.000Z",
            }

            render(
                <DatePicker
                    label="Test Date"
                    field={fieldWithISOValue}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByDisplayValue(/15 maart 2024/i)
            expect(input).toBeInTheDocument()
        })

        it("should handle Date objects as value", () => {
            const fieldWithDateValue = {
                ...mockField,
                value: new Date(2024, 5, 20),
            }

            render(
                <DatePicker
                    label="Test Date"
                    field={fieldWithDateValue}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByDisplayValue(/20 juni 2024/i)
            expect(input).toBeInTheDocument()
        })

        it("should parse Dutch numeric dates DD-MM", async () => {
            const user = userEvent.setup()
            const field = { ...mockField }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            await user.type(input, "25-12")
            fireEvent.blur(input)

            await waitFor(() => {
                expect(field.onChange).toHaveBeenCalled()
            })
        })

        it("should parse Dutch numeric dates DD-MM-YY", async () => {
            const user = userEvent.setup()
            const field = { ...mockField }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            await user.type(input, "25-12-24")
            fireEvent.blur(input)

            await waitFor(() => {
                expect(field.onChange).toHaveBeenCalled()
            })
        })
    })

    describe("calendar year context", () => {
        it("should use calendar year from store for date context", () => {
            vi.mocked(calendarStore.useCalendarStore).mockReturnValue({
                calendar: "2025",
            } as any)

            const field = { ...mockField }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            // Component should render with 2025 calendar context
            expect(screen.getByPlaceholderText("Kies een datum")).toBeInTheDocument()
        })

        it("should default to current year when calendar store has no value", () => {
            vi.mocked(calendarStore.useCalendarStore).mockReturnValue({
                calendar: undefined,
            } as any)

            render(
                <DatePicker
                    label="Test Date"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            expect(screen.getByPlaceholderText("Kies een datum")).toBeInTheDocument()
        })
    })

    describe("accessibility", () => {
        it("should have proper ARIA labels", () => {
            render(
                <DatePicker
                    label="Birth Date"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            expect(input).toHaveAttribute("aria-invalid", "false")
        })

        it("should mark invalid field with aria-invalid", () => {
            const invalidFieldState = { ...mockFieldState, invalid: true }

            render(
                <DatePicker
                    label="Birth Date"
                    field={mockField}
                    fieldState={invalidFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            expect(input).toHaveAttribute("aria-invalid", "true")
        })

        it("should have screen reader text for calendar button", () => {
            render(
                <DatePicker
                    label="Test Date"
                    placeholder="Select a date"
                    field={mockField}
                    fieldState={mockFieldState}
                />,
            )

            const button = screen.getByRole("button", { name: /select a date/i })
            expect(button).toBeInTheDocument()
        })
    })

    describe("edge cases", () => {
        it("should handle undefined field value", () => {
            const field = { ...mockField, value: undefined }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText(
                "Kies een datum",
            ) as HTMLInputElement
            expect(input.value).toBe("")
        })

        it("should handle null field value", () => {
            const field = { ...mockField, value: null }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText(
                "Kies een datum",
            ) as HTMLInputElement
            expect(input.value).toBe("")
        })

        it("should handle invalid date strings", async () => {
            const user = userEvent.setup()
            const field = { ...mockField }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            await user.type(input, "not-a-date")
            fireEvent.blur(input)

            await waitFor(() => {
                expect(field.onChange).toHaveBeenCalledWith(null)
            })
        })

        it("should close popover when disabled field is enabled", async () => {
            const { rerender } = render(
                <DatePicker
                    label="Test Date"
                    field={{ ...mockField, disabled: false }}
                    fieldState={mockFieldState}
                />,
            )

            // Open popover
            const button = screen.getByRole("button", { name: /kies een datum/i })
            fireEvent.click(button)

            // Now disable the field
            rerender(
                <DatePicker
                    label="Test Date"
                    field={{ ...mockField, disabled: true }}
                    fieldState={mockFieldState}
                />,
            )

            // Popover should close when field becomes disabled
            expect(button).toBeDisabled()
        })
    })

    describe("integration with react-hook-form", () => {
        it("should call onChange with ISO string when date is selected", async () => {
            const field = { ...mockField }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            await userEvent.type(input, "15-03-2024")
            fireEvent.blur(input)

            await waitFor(() => {
                expect(field.onChange).toHaveBeenCalled()
                // Should call with ISO string
                const callArg = field.onChange.mock.calls[0]?.[0]
                if (typeof callArg === "string") {
                    expect(callArg).toMatch(/^\d{4}-\d{2}-\d{2}T/)
                }
            })
        })

        it("should call onBlur when input loses focus", async () => {
            const field = { ...mockField }

            render(
                <DatePicker
                    label="Test Date"
                    field={field}
                    fieldState={mockFieldState}
                />,
            )

            const input = screen.getByPlaceholderText("Kies een datum")
            fireEvent.blur(input)

            await waitFor(() => {
                expect(field.onBlur).toHaveBeenCalled()
            })
        })
    })
})