import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { NavigationProgress } from "./navigation-progress"
import * as ReactRouter from "react-router"
import * as Sentry from "@sentry/react-router"
import { clientConfig } from "~/lib/config"

// Mock react-router hooks
vi.mock("react-router", async () => {
    const actual = await vi.importActual("react-router")
    return {
        ...actual,
        useNavigation: vi.fn(),
        useMatches: vi.fn(),
    }
})

// Mock Sentry
vi.mock("@sentry/react-router", () => ({
    metrics: {
        count: vi.fn(),
        distribution: vi.fn(),
    },
}))

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock clientConfig
vi.mock("~/lib/config", () => ({
    clientConfig: {
        analytics: {
            sentry: true,
        },
    },
}))

describe("NavigationProgress component", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
    })

    describe("visibility behavior", () => {
        it("should not show immediately when navigation starts", () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            render(<NavigationProgress />)

            // Should not be visible immediately
            expect(screen.queryByText("Even geduld…")).not.toBeInTheDocument()
        })

        it("should show after 500ms delay when navigation is loading", async () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            render(<NavigationProgress />)

            // Not visible yet
            expect(screen.queryByText("Even geduld…")).not.toBeInTheDocument()

            // Fast-forward 500ms
            act(() => {
                vi.advanceTimersByTime(500)
            })

            // Now should be visible
            await waitFor(() => {
                expect(screen.getByText("Even geduld…")).toBeInTheDocument()
            })
        })

        it("should not show if navigation completes before 500ms", () => {
            const { rerender } = render(<NavigationProgress />)

            // Start navigation
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            rerender(<NavigationProgress />)

            // Advance time but not enough to show
            act(() => {
                vi.advanceTimersByTime(300)
            })

            // Navigation completes
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "idle",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })

            rerender(<NavigationProgress />)

            // Should never have been shown
            expect(screen.queryByText("Even geduld…")).not.toBeInTheDocument()
        })

        it("should hide when navigation completes", async () => {
            const { rerender } = render(<NavigationProgress />)

            // Start navigation
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            rerender(<NavigationProgress />)

            // Wait for indicator to show
            act(() => {
                vi.advanceTimersByTime(500)
            })

            await waitFor(() => {
                expect(screen.getByText("Even geduld…")).toBeInTheDocument()
            })

            // Navigation completes
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "idle",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })

            rerender(<NavigationProgress />)

            // Should hide
            await waitFor(() => {
                expect(screen.queryByText("Even geduld…")).not.toBeInTheDocument()
            })
        })
    })

    describe("route-specific behavior", () => {
        it("should not show when route has hideNavigationProgress handle", () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([
                {
                    id: "route-1",
                    pathname: "/test",
                    params: {},
                    data: {},
                    handle: { hideNavigationProgress: true },
                },
            ])

            render(<NavigationProgress />)

            // Fast-forward past 500ms
            act(() => {
                vi.advanceTimersByTime(600)
            })

            // Should NOT be visible because route opted out
            expect(screen.queryByText("Even geduld…")).not.toBeInTheDocument()
        })

        it("should show when route does not have hideNavigationProgress handle", async () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([
                {
                    id: "route-1",
                    pathname: "/test",
                    params: {},
                    data: {},
                    handle: {},
                },
            ])

            render(<NavigationProgress />)

            // Fast-forward past 500ms
            act(() => {
                vi.advanceTimersByTime(500)
            })

            // Should be visible
            await waitFor(() => {
                expect(screen.getByText("Even geduld…")).toBeInTheDocument()
            })
        })

        it("should handle null handle gracefully", async () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([
                {
                    id: "route-1",
                    pathname: "/test",
                    params: {},
                    data: {},
                    handle: null,
                },
            ])

            render(<NavigationProgress />)

            act(() => {
                vi.advanceTimersByTime(500)
            })

            await waitFor(() => {
                expect(screen.getByText("Even geduld…")).toBeInTheDocument()
            })
        })

        it("should check all matched routes for hideNavigationProgress", () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([
                {
                    id: "route-1",
                    pathname: "/parent",
                    params: {},
                    data: {},
                    handle: {},
                },
                {
                    id: "route-2",
                    pathname: "/parent/child",
                    params: {},
                    data: {},
                    handle: { hideNavigationProgress: true },
                },
            ])

            render(<NavigationProgress />)

            act(() => {
                vi.advanceTimersByTime(600)
            })

            // Should NOT show because one route opted out
            expect(screen.queryByText("Even geduld…")).not.toBeInTheDocument()
        })
    })

    describe("Sentry metrics", () => {
        it("should emit count metric when indicator is shown", async () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            render(<NavigationProgress />)

            act(() => {
                vi.advanceTimersByTime(500)
            })

            await waitFor(() => {
                expect(Sentry.metrics.count).toHaveBeenCalledWith(
                    "navigation_progress.shown",
                    1,
                )
            })
        })

        it("should emit duration metric when navigation completes", async () => {
            const { rerender } = render(<NavigationProgress />)

            // Start navigation
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            rerender(<NavigationProgress />)

            // Show indicator
            act(() => {
                vi.advanceTimersByTime(500)
            })

            await waitFor(() => {
                expect(screen.getByText("Even geduld…")).toBeInTheDocument()
            })

            // Advance time while loading
            act(() => {
                vi.advanceTimersByTime(1000)
            })

            // Complete navigation
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "idle",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })

            rerender(<NavigationProgress />)

            // Should emit duration metric
            await waitFor(() => {
                expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
                    "navigation_progress.duration_ms",
                    expect.any(Number),
                )
            })

            // Duration should be around 1500ms (500ms delay + 1000ms loading)
            const duration = vi.mocked(Sentry.metrics.distribution).mock
                .calls[0][1] as number
            expect(duration).toBeGreaterThanOrEqual(1000)
        })

        it("should not emit metrics when Sentry is disabled", async () => {
            // Temporarily disable Sentry
            vi.mocked(clientConfig).analytics.sentry = false

            const { rerender } = render(<NavigationProgress />)

            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            rerender(<NavigationProgress />)

            act(() => {
                vi.advanceTimersByTime(500)
            })

            // Sentry metrics should not be called
            expect(Sentry.metrics.count).not.toHaveBeenCalled()

            // Re-enable for other tests
            vi.mocked(clientConfig).analytics.sentry = true
        })
    })

    describe("navigation states", () => {
        it("should handle submitting state", async () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "submitting",
                location: undefined,
                formMethod: "POST",
                formAction: "/submit",
                formEncType: "application/x-www-form-urlencoded",
                formData: new FormData(),
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            render(<NavigationProgress />)

            act(() => {
                vi.advanceTimersByTime(500)
            })

            await waitFor(() => {
                expect(screen.getByText("Even geduld…")).toBeInTheDocument()
            })
        })

        it("should remain visible during multiple navigation states", async () => {
            const { rerender } = render(<NavigationProgress />)

            // Start with loading
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            rerender(<NavigationProgress />)

            act(() => {
                vi.advanceTimersByTime(500)
            })

            await waitFor(() => {
                expect(screen.getByText("Even geduld…")).toBeInTheDocument()
            })

            // Change to submitting
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "submitting",
                location: undefined,
                formMethod: "POST",
                formAction: "/submit",
                formEncType: "application/x-www-form-urlencoded",
                formData: new FormData(),
                json: undefined,
                text: undefined,
            })

            rerender(<NavigationProgress />)

            // Should still be visible
            expect(screen.getByText("Even geduld…")).toBeInTheDocument()
        })
    })

    describe("UI components", () => {
        it("should render backdrop and card when visible", async () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            const { container } = render(<NavigationProgress />)

            act(() => {
                vi.advanceTimersByTime(500)
            })

            await waitFor(() => {
                expect(screen.getByText("Even geduld…")).toBeInTheDocument()
            })

            // Check for backdrop
            const backdrop = container.querySelector(".backdrop-blur-sm")
            expect(backdrop).toBeInTheDocument()

            // Check for loading text
            expect(screen.getByText("Even geduld…")).toBeInTheDocument()
        })

        it("should render loading spinner icon", async () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            const { container } = render(<NavigationProgress />)

            act(() => {
                vi.advanceTimersByTime(500)
            })

            await waitFor(() => {
                const spinner = container.querySelector(".animate-spin")
                expect(spinner).toBeInTheDocument()
            })
        })
    })

    describe("edge cases", () => {
        it("should handle rapid navigation changes", async () => {
            const { rerender } = render(<NavigationProgress />)

            // Start navigation
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            rerender(<NavigationProgress />)

            // Quickly switch to idle before timeout
            act(() => {
                vi.advanceTimersByTime(100)
            })

            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "idle",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })

            rerender(<NavigationProgress />)

            // Start another navigation
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })

            rerender(<NavigationProgress />)

            act(() => {
                vi.advanceTimersByTime(500)
            })

            await waitFor(() => {
                expect(screen.getByText("Even geduld…")).toBeInTheDocument()
            })
        })

        it("should cleanup timers on unmount", () => {
            vi.mocked(ReactRouter.useNavigation).mockReturnValue({
                state: "loading",
                location: undefined,
                formMethod: undefined,
                formAction: undefined,
                formEncType: undefined,
                formData: undefined,
                json: undefined,
                text: undefined,
            })
            vi.mocked(ReactRouter.useMatches).mockReturnValue([])

            const { unmount } = render(<NavigationProgress />)

            // Unmount before timer fires
            act(() => {
                vi.advanceTimersByTime(300)
            })

            unmount()

            // Advance past timeout
            act(() => {
                vi.advanceTimersByTime(300)
            })

            // Should not throw or cause issues
            expect(screen.queryByText("Even geduld…")).not.toBeInTheDocument()
        })
    })
})