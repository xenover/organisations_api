export interface OrganisationInput {
  org_name: string;
  daughters?: OrganisationInput[];
}

export interface OrganisationQuery {
  name?: string;
  page?: string;
}

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
