import type { Knex } from "knex";
import type { OrganisationRecord } from "../types/organisations.js";

export class OrganisationRepository {
  constructor(private readonly database: Knex) {}

  async findOrCreate(name: string): Promise<number> {
    const existing = await this.database<OrganisationRecord>("organisations")
      .select("id")
      .where({ name })
      .first();

    if (existing) {
      return existing.id;
    }

    const [id] = await this.database<OrganisationRecord>(
      "organisations",
    ).insert({
      name,
    });
    if (id === undefined) {
      throw new Error(`Organisation not found after insertion: ${name}`);
    }
    return id;
  }
}
