import {
    boolean,
    index,
    jsonb,
    pgSchema,
    text,
    timestamp,
} from "drizzle-orm/pg-core"

export const fdmCalculatorSchema = pgSchema("fdm-calculator")
export type fdmSchemaCalculatorTypeSelect = typeof fdmCalculatorSchema.table

export const calculationCache = fdmCalculatorSchema.table(
    "calculation_cache",
    {
        calculation_hash: text().notNull().primaryKey(),
        calculation_function: text().notNull(),
        calculator_version: text(),
        input: jsonb().notNull(),
        result: jsonb().notNull(),
        entity_type: text(), // e.g., 'farm', 'field'
        entity_id: text(), // The ID of the farm or field
        is_processing: boolean().notNull().default(false), // Lock for background workers
        created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("calculation_cache_entity_idx").on(
            table.entity_type,
            table.entity_id,
        ),
        index("calculation_cache_function_idx").on(table.calculation_function),
    ],
)

export type CalculationCacheTypeSelect = typeof calculationCache.$inferSelect
export type CalculationCacheTypeInsert = typeof calculationCache.$inferInsert

export const calculationErrors = fdmCalculatorSchema.table(
    "calculation_errors",
    {
        calculation_error_id: text().primaryKey(),
        calculation_function: text(),
        calculator_version: text(),
        input: jsonb(),
        error_message: text(),
        stack_trace: text(),
        created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
)

export type CalculationErrorsTypeSelect = typeof calculationErrors.$inferSelect
export type CalculationErrorsTypeInsert = typeof calculationErrors.$inferInsert
