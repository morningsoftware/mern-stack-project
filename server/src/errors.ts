import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface HttpError extends Error {
  status: number;
}

export function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => unknown
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
