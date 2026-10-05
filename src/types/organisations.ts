export type {
  OrganisationInput,
  OrganisationQuery,
} from "../schemas/organisations.js";

export interface OrganisationRecord {
  id: number;
  name: string;
}

export interface RelationshipRecord {
  id: number;
  child_id: number;
  parent_id: number;
}

export interface OrganisationRelationship {
  org_name: string;
  relationship_type: "parent" | "sister" | "daughter";
}
