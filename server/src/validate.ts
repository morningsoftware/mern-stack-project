import { ObjectId } from "mongodb";
import type { Collection, Document, Filter, WithId } from "mongodb";
import { httpError } from "./errors.js";

export function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw httpError(400, `${label} is required`);
  }
  return value.trim();
}

export function optionalString(
  value: unknown,
  label: string
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw httpError(400, `${label} must be a string`);
  }
  return value.trim();
}

export function oneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string
): T[number] {
  if (!allowed.includes(value as T[number])) {
    throw httpError(400, `${label} must be one of: ${allowed.join(", ")}`);
  }
  return value as T[number];
}

export function parseObjectId(value: unknown, label: string): ObjectId {
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    throw httpError(400, `${label} must be a valid id`);
  }
  return new ObjectId(value);
}

export function optionalObjectId(
  value: unknown,
  label: string
): ObjectId | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return parseObjectId(value, label);
}

export function parseDate(value: unknown, label: string): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) {
    throw httpError(400, `${label} must be a valid date`);
  }
  return date;
}

export function parseRating(value: unknown): number {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw httpError(400, "rating must be an integer from 1 to 5");
  }
  return rating;
}

export async function requireDoc<T extends Document>(
  collection: Collection<T>,
  id: ObjectId,
  label: string
): Promise<WithId<T>> {
  const doc = await collection.findOne({ _id: id } as Filter<T>);
  if (!doc) throw httpError(404, `${label} not found`);
  return doc;
}
