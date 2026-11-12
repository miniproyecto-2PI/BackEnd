import { NextFunction, Request, Response } from 'express';
import { z, ZodError, ZodErrorMap, ZodIssueCode, ZodTypeAny } from 'zod';
import { ValidationError } from '../types/errors.types';

/**
 * Mensajes por defecto en español para los casos que un esquema no personaliza.
 * Los esquemas de src/validators definen mensajes propios para las reglas de negocio.
 */
export const spanishErrorMap: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: 'Este campo es obligatorio.' };
      }
      return { message: 'El valor enviado no tiene el formato esperado.' };
    case ZodIssueCode.too_small:
      return { message: `Debe tener al menos ${issue.minimum} caracteres.` };
    case ZodIssueCode.too_big:
      return { message: `Debe tener como máximo ${issue.maximum} caracteres.` };
    case ZodIssueCode.invalid_string:
      return { message: 'El formato no es válido.' };
    case ZodIssueCode.invalid_enum_value:
      return { message: 'El valor seleccionado no es válido.' };
    case ZodIssueCode.unrecognized_keys:
      return { message: `Campos no permitidos: ${issue.keys.join(', ')}.` };
    default:
      return { message: ctx.defaultError };
  }
};

/** Convierte los issues de Zod en { campo: mensaje } (primer mensaje por campo). */
export function zodIssuesToFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'body';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Valida req.body con un esquema Zod. Si es válido, reemplaza req.body por los
 * datos ya normalizados (trim, etc.). Si no, responde 400 VALIDATION_ERROR con
 * el detalle por campo.
 */
export const validateBody =
  (schema: ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {}, { errorMap: spanishErrorMap });
    if (!result.success) {
      return next(
        new ValidationError(
          'Los datos enviados son inválidos. Revise los campos señalados.',
          zodIssuesToFields(result.error)
        )
      );
    }
    req.body = result.data as z.infer<typeof schema>;
    next();
  };
