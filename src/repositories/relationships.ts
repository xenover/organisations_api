import type { Knex } from "knex";
import type {
  OrganisationRelationship,
  RelationshipRecord,
} from "../types/organisations.js";

const LIMIT = 100;

export class RelationshipRepository {
  constructor(private readonly database: Knex) {}

  async createIfMissing(childId: number, parentId: number): Promise<void> {
    const existing = await this.database<RelationshipRecord>("relationships")
      .select("id")
      .where({ child_id: childId, parent_id: parentId })
      .first();

    if (!existing) {
      await this.database<RelationshipRecord>("relationships").insert({
        child_id: childId,
        parent_id: parentId,
      });
    }
  }

  async findByOrganisationName(
    name: string,
    page = 1,
  ): Promise<OrganisationRelationship[]> {
    // Keep the original parameterized UNION, ordering, and page-based pagination.
    return this.database.raw<OrganisationRelationship[]>(
      `
SELECT * FROM (
	SELECT parent.name as org_name, "parent" as relationship_type
	FROM organisations parent
	JOIN relationships ON parent.id = parent_id
	JOIN organisations child ON child.id = child_id
	WHERE child.name = ?
	UNION
	SELECT DISTINCT(sister.name) as org_name, "sister" as relationship_type
	FROM organisations parent
	JOIN relationships r1 ON parent.id = r1.parent_id
	JOIN organisations child ON child.id  = r1.child_id
	JOIN relationships r2 ON r1.parent_id = r2.parent_id
		AND r2. child_id != child.id
	JOIN organisations sister ON sister.id = r2.child_id
	WHERE child.name = ?
	UNION
	SELECT parent.name as org_name, "daughter" as relationship_type
	FROM organisations parent
	JOIN relationships ON parent.id = child_id
	JOIN organisations child ON child.id  = parent_id
	WHERE child.name = ?
)
ORDER BY 1
LIMIT ?
OFFSET ?;
`,
      [name, name, name, LIMIT, page * LIMIT - LIMIT],
    );
  }
}
