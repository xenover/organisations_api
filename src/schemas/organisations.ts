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

// GET requires one nonblank name. Page is a decimal string on the wire, parsed
// to a positive safe integer for handlers; omitting it supplies page 1.
export const organisationQuerySchema = z.object({
  name: organisationNameSchema,
  page: z
    .string()
    .regex(/^\d+$/, "Page must be a positive integer")
    .transform(Number)
    .pipe(z.number().int().positive())
    .default(1),
});

export type OrganisationInput = z.infer<typeof organisationInputSchema>;
export type OrganisationQuery = z.infer<typeof organisationQuerySchema>;
