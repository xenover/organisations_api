export type {
  OrganisationInput,
  OrganisationQuery,
  OrganisationParams,
  OrganisationUpdate,
  PaginationQuery,
} from "../schemas/organisations.js";

export interface Organisation {
  id: number;
  org_name: string;
}

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { limit: number; offset: number; total_count: number };
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
