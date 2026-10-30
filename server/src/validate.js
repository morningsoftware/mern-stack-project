import { ObjectId } from "mongodb";
import { httpError } from "./errors.js";

export function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw httpError(400, `${label} is required`);
  }
  return value.trim();
}

export function optionalString(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw httpError(400, `${label} must be a string`);
  }
  return value.trim();
}

export function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw httpError(400, `${label} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

export function parseObjectId(value, label) {
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    throw httpError(400, `${label} must be a valid id`);
  }
  return new ObjectId(value);
}

export function optionalObjectId(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  return parseObjectId(value, label);
}

export function parseDate(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw httpError(400, `${label} must be a valid date`);
  }
  return date;
}

export function parseRating(value) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw httpError(400, "rating must be an integer from 1 to 5");
  }
  return rating;
}

export async function requireDoc(collection, id, label) {
  const doc = await collection.findOne({ _id: id });
  if (!doc) throw httpError(404, `${label} not found`);
  return doc;
}
