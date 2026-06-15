import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { sendError } from "../utils/apiResponse";

export function validate(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        sendError(res, "Validation failed", 422, details);
        return;
      }
      next(err);
    }
  };
}
