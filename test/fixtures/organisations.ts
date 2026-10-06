import type { OrganisationInput } from "../../src/types/organisations.js";

export function paginatedHierarchy(count = 205) {
  return {
    org_name: "PaginationParent",
    daughters: Array.from({ length: count }, (_, index) => ({
      org_name: `Child ${String(index).padStart(3, "0")}`,
    })),
  } satisfies OrganisationInput;
}
