export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 422 | 500,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
