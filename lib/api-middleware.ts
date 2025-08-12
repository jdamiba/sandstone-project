import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  formatErrorResponse,
  UnauthorizedError,
  BadRequestError,
} from "./errors";
import { auth } from "@clerk/nextjs/server";
import { getCurrentUser } from "./auth";

// Type for API route handlers (legacy)
export type ApiHandler = (
  req: NextRequest,
  context?: Record<string, unknown>,
  params?: Record<string, unknown>
) => Promise<NextResponse>;

// Type for Next.js App Router route handlers
export type AppRouterHandler = (
  req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) => Promise<NextResponse>;

// Type for Next.js App Router route handlers with params
export type AppRouterHandlerWithParams = (
  req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any
) => Promise<NextResponse>;

// Middleware wrapper for API routes (legacy)
export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context?: Record<string, unknown>) => {
    try {
      return await handler(req, context);
    } catch (error) {
      const appError = handleApiError(error);
      const errorResponse = formatErrorResponse(appError);

      return NextResponse.json(errorResponse, {
        status: appError.statusCode,
      });
    }
  };
}

// Middleware wrapper for Next.js App Router routes
export function withErrorHandlingAppRouter<
  T extends AppRouterHandler | AppRouterHandlerWithParams
>(handler: T): T {
  return (async (
    req: NextRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: any
  ) => {
    try {
      if (params) {
        return await (handler as AppRouterHandlerWithParams)(
          req,
          context,
          params
        );
      } else {
        return await (handler as AppRouterHandler)(req, context);
      }
    } catch (error) {
      const appError = handleApiError(error);
      const errorResponse = formatErrorResponse(appError);

      return NextResponse.json(errorResponse, {
        status: appError.statusCode,
      });
    }
  }) as T;
}

// Middleware wrapper that requires authentication (legacy)
export function withAuth(handler: ApiHandler): ApiHandler {
  return withErrorHandling(
    async (req: NextRequest, context?: Record<string, unknown>) => {
      const { userId } = await auth();

      if (!userId) {
        throw new UnauthorizedError("Authentication required");
      }

      const user = await getCurrentUser();
      if (!user) {
        throw new UnauthorizedError("User not found");
      }

      // Add user to context for the handler
      const authContext = {
        ...(context && typeof context === "object" ? context : {}),
        user,
        userId,
      };
      return await handler(req, authContext);
    }
  );
}

// Middleware wrapper that requires authentication for Next.js App Router
export function withAuthAppRouter<
  T extends AppRouterHandler | AppRouterHandlerWithParams
>(handler: T): T {
  return withErrorHandlingAppRouter((async (
    req: NextRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    context: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: any
  ) => {
    const { userId } = await auth();

    if (!userId) {
      throw new UnauthorizedError("Authentication required");
    }

    const user = await getCurrentUser();
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    // Add user to context for the handler
    const authContext = {
      ...context,
      user,
      userId,
    };

    if (params) {
      return await (handler as AppRouterHandlerWithParams)(
        req,
        authContext,
        params
      );
    } else {
      return await (handler as AppRouterHandler)(req, authContext);
    }
  }) as T);
}

// Middleware wrapper that validates JSON body
export function withJsonValidation<T>(
  handler: (
    req: NextRequest,
    body: T,
    context?: Record<string, unknown>
  ) => Promise<NextResponse>,
  validator?: (body: unknown) => T
): ApiHandler {
  return withErrorHandling(
    async (req: NextRequest, context?: Record<string, unknown>) => {
      let body: T;

      try {
        body = await req.json();
      } catch {
        throw new BadRequestError("Invalid JSON in request body");
      }

      if (validator) {
        try {
          body = validator(body);
        } catch (error) {
          if (error instanceof Error) {
            throw new BadRequestError(error.message);
          }
          throw new BadRequestError("Invalid request body");
        }
      }

      return await handler(req, body, context);
    }
  );
}

// Middleware wrapper that requires specific HTTP methods
export function withMethod(methods: string[], handler: ApiHandler): ApiHandler {
  return withErrorHandling(
    async (req: NextRequest, context?: Record<string, unknown>) => {
      if (!methods.includes(req.method)) {
        throw new BadRequestError(
          `Method ${req.method} not allowed. Allowed methods: ${methods.join(
            ", "
          )}`
        );
      }

      return await handler(req, context);
    }
  );
}

// Combined middleware for authenticated JSON endpoints
export function withAuthAndJson<T>(
  handler: (
    req: NextRequest,
    body: T,
    context?: Record<string, unknown>
  ) => Promise<NextResponse>,
  validator?: (body: unknown) => T
): ApiHandler {
  return withAuth(withJsonValidation(handler, validator));
}

// Utility function to create success responses
export function createSuccessResponse(
  data: Record<string, unknown>,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status });
}

// Utility function to create paginated responses
export function createPaginatedResponse(
  data: Record<string, unknown>[],
  total: number,
  limit: number,
  offset: number,
  additionalFields?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
    ...additionalFields,
  });
}

// Utility function to validate query parameters
export function validateQueryParams(
  searchParams: URLSearchParams,
  requiredParams: string[] = [],
  optionalParams: Record<string, (value: string) => unknown> = {}
): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Check required parameters
  for (const param of requiredParams) {
    const value = searchParams.get(param);
    if (!value) {
      throw new BadRequestError(`Missing required query parameter: ${param}`);
    }
    params[param] = value;
  }

  // Process optional parameters
  for (const [param, validator] of Object.entries(optionalParams)) {
    const value = searchParams.get(param);
    if (value !== null) {
      try {
        params[param] = validator(value);
      } catch {
        throw new BadRequestError(
          `Invalid value for query parameter ${param}: ${value}`
        );
      }
    }
  }

  return params;
}

// Common query parameter validators
export const queryValidators = {
  integer: (min?: number, max?: number) => (value: string) => {
    const num = parseInt(value);
    if (isNaN(num)) {
      throw new Error("Must be a valid integer");
    }
    if (min !== undefined && num < min) {
      throw new Error(`Must be at least ${min}`);
    }
    if (max !== undefined && num > max) {
      throw new Error(`Must be no more than ${max}`);
    }
    return num;
  },

  boolean: () => (value: string) => {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error("Must be true or false");
  },

  string: (minLength?: number, maxLength?: number) => (value: string) => {
    if (minLength !== undefined && value.length < minLength) {
      throw new Error(`Must be at least ${minLength} characters`);
    }
    if (maxLength !== undefined && value.length > maxLength) {
      throw new Error(`Must be no more than ${maxLength} characters`);
    }
    return value;
  },

  array:
    (separator: string = ",") =>
    (value: string) => {
      return value
        .split(separator)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    },
};
