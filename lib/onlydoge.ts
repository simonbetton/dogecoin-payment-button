export const DEFAULT_ONLYDOGE_API_BASE_URL = "https://platform.onlydoge.io";

export const ONLYDOGE_MEMPOOL_WATCH_PATH = "/v1/explorer/mempool/watch";

export const getOnlyDogeApiToken = (): string | undefined => {
  const token = process.env.ONLYDOGE_API_TOKEN?.trim();
  return token || undefined;
};

export const getOnlyDogeApiBaseUrl = (): string => {
  const baseUrl = process.env.ONLYDOGE_API_BASE_URL?.trim();
  return baseUrl || DEFAULT_ONLYDOGE_API_BASE_URL;
};

export const buildOnlyDogeMempoolWatchUrl = (
  address: string,
  minValueBase?: string
): string => {
  const url = new URL(
    ONLYDOGE_MEMPOOL_WATCH_PATH,
    `${getOnlyDogeApiBaseUrl().replace(/\/$/u, "")}/`
  );
  url.searchParams.set("address", address);
  if (minValueBase !== undefined) {
    url.searchParams.set("minValueBase", minValueBase);
  }
  return url.toString();
};
