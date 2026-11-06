// Sunucu hatası + nedeni (hint). Kod ve abonelik hataları: ortak/sozlesme/durumlar.md 11–12.
export class AppError extends Error {
  hint?: string;
  constructor(message: string, hint?: string | null) {
    super(message);
    this.hint = hint ?? undefined;
  }
}

export const toAppError = (e: { message: string; hint?: string | null }) => new AppError(e.message, e.hint);

export const fail = (e: { message: string; hint?: string | null } | null) => {
  if (e) throw toAppError(e);
};

export const hintOf = (e: unknown) => (e as AppError | undefined)?.hint;
