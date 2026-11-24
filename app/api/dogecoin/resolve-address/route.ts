import {
  AddressSelectionExhaustedError,
  createInitialSelectionState,
  isSelectionState,
  resolveDogecoinPaymentAddress,
} from "@/registry/default/dogecoin-payment-button";
import type {
  AddressSelectionResult,
  SelectionState,
} from "@/registry/default/dogecoin-payment-button";

export const dynamic = "force-dynamic";

const jsonError = (message: string, status: number): Response =>
  Response.json({ error: message }, { status });

const parseSelectionState = (body: unknown): SelectionState | null => {
  if (body === null || body === undefined) {
    return createInitialSelectionState();
  }

  if (!isSelectionState(body)) {
    return null;
  }

  return body;
};

/**
 * Public payment-address resolver for the live demo.
 *
 * Intentionally unauthenticated: checkout visitors are anonymous. Kept as a
 * Route Handler (not a Server Action) so the public contract is explicit HTTP.
 */
export const POST = async (request: Request): Promise<Response> => {
  const xpub = process.env.DOGECOIN_XPUB;
  if (!xpub) {
    return jsonError(
      "DOGECOIN_XPUB is not configured. Add a dedicated account xpub to your environment.",
      503
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be JSON.", 400);
  }

  const selection = parseSelectionState(body);
  if (!selection) {
    return jsonError(
      "Body must include a valid receive-chain cursor and boolean uncheckedMode.",
      400
    );
  }

  if (request.signal.aborted) {
    return new Response(null, { status: 499 });
  }

  try {
    const result: AddressSelectionResult = await resolveDogecoinPaymentAddress({
      signal: request.signal,
      startIndex: selection.startIndex,
      uncheckedMode: selection.uncheckedMode,
      xpub,
    });
    request.signal.throwIfAborted();
    return Response.json(result);
  } catch (error: unknown) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (error instanceof AddressSelectionExhaustedError) {
      return jsonError(error.message, 422);
    }
    const message =
      error instanceof Error
        ? error.message
        : "Unable to resolve a Dogecoin payment address.";
    return jsonError(message, 500);
  }
};
