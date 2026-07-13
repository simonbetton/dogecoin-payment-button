const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/u;

export class PaymentUriError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentUriError";
  }
}

/**
 * Validate a suggested DOGE amount as a positive decimal string with at most
 * 8 fractional digits.
 */
export const normalizeDogecoinAmount = (amount: string): string => {
  const trimmed = amount.trim();

  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new PaymentUriError(
      "Amount must be a positive decimal string with up to 8 decimal places."
    );
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) {
    throw new PaymentUriError("Amount must be greater than zero.");
  }

  const [whole, fractional] = trimmed.split(".");
  if (!fractional) {
    return whole;
  }

  const normalizedFractional = fractional.replace(/0+$/u, "");
  return normalizedFractional ? `${whole}.${normalizedFractional}` : whole;
};

export const buildDogecoinPaymentUri = (
  address: string,
  amount?: string
): string => {
  if (!amount) {
    return `dogecoin:${address}`;
  }

  const normalized = normalizeDogecoinAmount(amount);
  return `dogecoin:${address}?amount=${normalized}`;
};
