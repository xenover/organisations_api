import { z } from "zod";

const organisationNameSchema = z
  .string()
  .refine((name) => name.trim().length > 0, {
    message: "Organisation name must not be blank",
  });

export const organisationInputSchema = z.object({
  org_name: organisationNameSchema,
  get daughters() {
    return z.array(organisationInputSchema).optional();
  },
});

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
