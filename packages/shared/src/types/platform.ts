export type AccessType = "owner" | "admin_access" | "shared_access";

export type HomeRole = "owner" | "admin" | "member" | "viewer";

export type ProductStatus =
  | "draft"
  | "prototype"
  | "beta"
  | "production"
  | "discontinued";

export interface TimestampedRecord {
  createdAt: string;
  updatedAt: string;
}
