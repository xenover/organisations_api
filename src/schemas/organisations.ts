import { z } from "zod";

// Names must contain a non-whitespace character; preserve the original spelling.
const organisationNameSchema = z
  .string()
  .refine((name) => name.trim().length > 0, {
    message: "Organisation name must not be blank",
  });

// POST requires org_name at every level. Daughters may be omitted or empty;
// otherwise every daughter follows the same recursive schema. Unknown keys are stripped.
export const organisationInputSchema = z.object({
  org_name: organisationNameSchema,
  get daughters() {
    return z.array(organisationInputSchema).optional();
  },
});

// PATCH renames one organisation; relationship changes use the tree POST endpoint.
export const organisationUpdateSchema = z.strictObject({
  org_name: organisationNameSchema,
});
const positiveInteger = z
  .string()
  .regex(/^\d+$/, "Must be a positive integer")
  .transform(Number)
  .pipe(z.number().int().positive());
const nonnegativeInteger = z
  .string()
  .regex(/^\d+$/, "Must be a nonnegative integer")
  .transform(Number)
  .pipe(z.number().int().nonnegative());

export const organisationParamsSchema = z.object({ id: positiveInteger });

const paginationInputSchema = z.object({
  page: positiveInteger.optional(),
  limit: positiveInteger.pipe(z.number().max(100)).default(100),
  offset: nonnegativeInteger.optional(),
});

function withPagination<
  Output extends { page?: number; limit: number; offset?: number },
>(schema: z.ZodType<Output>) {
  return schema
    .superRefine((value, ctx) => {
      if (value.page !== undefined && value.offset !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["offset"],
          message: "Use either page or offset",
        });
      }
    })
    .transform((value) => ({
      ...value,
      page: value.page ?? 1,
      offset: value.offset ?? ((value.page ?? 1) - 1) * value.limit,
    }))
    .refine((value) => Number.isSafeInteger(value.offset), {
      path: ["offset"],
      message: "Pagination offset must be a safe integer",
    });
}

// Limit defaults to 100 (maximum 100), offset to 0. The legacy page parameter
// remains available and computes offset using limit; page and offset cannot be mixed.
export const paginationQuerySchema = withPagination(paginationInputSchema);
// The name lookup also requires one nonblank name. Unknown query keys are stripped.
export const organisationQuerySchema = withPagination(
  paginationInputSchema.extend({
    name: organisationNameSchema,
  }),
);

export type OrganisationInput = z.infer<typeof organisationInputSchema>;
export type OrganisationQuery = z.infer<typeof organisationQuerySchema>;
export type OrganisationParams = z.infer<typeof organisationParamsSchema>;
export type OrganisationUpdate = z.infer<typeof organisationUpdateSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
