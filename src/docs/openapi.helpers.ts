import { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Utilidades para construir la especificación OpenAPI.
 *
 * `fromZod` convierte un esquema Zod (el mismo que valida la petición en
 * src/validators) a JSON Schema OpenAPI 3. Así Swagger y la validación real
 * nunca se desincronizan (TS-05: "esquemas reutilizados en Swagger").
 */
// Firma simplificada: la genérica de zod-to-json-schema provoca "Type instantiation is
// excessively deep" (TS2589) con esquemas Zod complejos.
const convert = zodToJsonSchema as unknown as (
  schema: ZodTypeAny,
  options: { target: 'openApi3'; $refStrategy: 'none' }
) => Record<string, unknown>;

export function fromZod(schema: ZodTypeAny): Record<string, unknown> {
  const json = convert(schema, { target: 'openApi3', $refStrategy: 'none' });
  delete json.$schema;
  return json;
}

/** Referencia a una respuesta de error reutilizable definida en components.responses. */
export const errorRef = (name: string) => ({ $ref: `#/components/responses/${name}` });

/** Respuesta 2xx con el envoltorio estándar { success, message, data, timestamp }. */
export function successResponse(
  description: string,
  dataSchema: Record<string, unknown>,
  example?: { message?: string; data?: unknown }
) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/SuccessEnvelope' },
            { type: 'object', properties: { data: dataSchema } },
          ],
        },
        ...(example
          ? {
              example: {
                success: true,
                message: example.message ?? description,
                data: example.data,
                timestamp: '2026-11-10T15:00:00.000Z',
              },
            }
          : {}),
      },
    },
  };
}

/** Cuerpo JSON de la petición a partir de un esquema Zod. */
export function jsonBody(schema: ZodTypeAny, example?: unknown, required = true) {
  return {
    required,
    content: {
      'application/json': {
        schema: fromZod(schema),
        ...(example !== undefined ? { example } : {}),
      },
    },
  };
}
