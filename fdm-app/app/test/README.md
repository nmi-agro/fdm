# Testing Guide for fdm-app

This directory contains test setup and utilities for the fdm-app frontend application.

## Setup

The test infrastructure uses:
- **Vitest** - Fast unit test framework
- **React Testing Library** - Testing utilities for React components
- **jsdom** - Browser environment simulation
- **@testing-library/jest-dom** - Custom matchers for DOM testing
- **@testing-library/user-event** - User interaction simulation

## Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (for development)
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

## Test Structure

Tests are colocated with source files using the `.test.ts` or `.test.tsx` naming convention:

```
app/
  ├── lib/
  │   ├── calendar.ts
  │   └── calendar.test.ts
  ├── components/
  │   └── custom/
  │       ├── date-picker.tsx
  │       └── date-picker.test.tsx
```

## Writing Tests

### Unit Tests (Utility Functions)

```typescript
import { describe, it, expect } from "vitest"
import { myUtilityFunction } from "./my-utility"

describe("myUtilityFunction", () => {
    it("should return expected result", () => {
        const result = myUtilityFunction(input)
        expect(result).toBe(expectedOutput)
    })
})
```

### Component Tests

```typescript
import { render, screen, fireEvent } from "@testing-library/react"
import { MyComponent } from "./my-component"

describe("MyComponent", () => {
    it("should render correctly", () => {
        render(<MyComponent />)
        expect(screen.getByText("Expected Text")).toBeInTheDocument()
    })

    it("should handle user interaction", async () => {
        const user = userEvent.setup()
        render(<MyComponent />)

        const button = screen.getByRole("button")
        await user.click(button)

        expect(screen.getByText("Updated Text")).toBeInTheDocument()
    })
})
```

## Test Coverage

Current test coverage includes:
- ✅ Calendar utilities (`lib/calendar.ts`)
- ✅ Date picker components (`components/custom/date-picker*.tsx`)
- ✅ Navigation progress component (`components/custom/navigation-progress.tsx`)

## Mocking

Common mocks are set up in `setup.ts`:
- `window.matchMedia` - For responsive design tests
- Component-specific mocks should be defined in individual test files

## CI/CD Integration

Tests are configured to run in continuous integration pipelines. The following commands are available:
- `pnpm test` - For CI environments (runs once, exits with code)
- `pnpm test:coverage` - Generates coverage reports for CI

## Best Practices

1. **Test behavior, not implementation** - Focus on what users see and do
2. **Use semantic queries** - Prefer `getByRole`, `getByLabelText` over `getByTestId`
3. **Avoid implementation details** - Don't test internal state or private methods
4. **Write descriptive test names** - Use "should" statements
5. **Keep tests isolated** - Each test should be independent
6. **Mock external dependencies** - API calls, stores, etc.