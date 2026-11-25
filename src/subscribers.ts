// --- Subscriber write requests ---
//
// Request bodies for the Publisher API endpoints that change subscriber
// state. Limits and defaults come from the API spec.

export const IMPORT_MAX_EMAILS = 100;
export const COMP_DEFAULT_DAYS = 30;
export const LIFETIME = "lifetime";
export const SECTION_EMAIL_SETTINGS = ["on", "off"] as const;

export interface SectionEmailSetting {
  sectionId: number;
  setting: (typeof SECTION_EMAIL_SETTINGS)[number];
}

export interface CompRequest {
  sendWelcomeEmails?: boolean;
  subscriptionLength?: number | typeof LIFETIME;
  expirationDate?: string;
  sectionEmailSettings?: SectionEmailSetting[];
}

// The API takes a length or an end date, never both. Unset fields are
// dropped so the API applies its own defaults.
export function compRequestBody(request: CompRequest): CompRequest {
  if (
    request.subscriptionLength !== undefined &&
    request.expirationDate !== undefined
  ) {
    throw new Error(
      "Use either subscriptionLength or expirationDate, not both."
    );
  }

  return Object.fromEntries(
    Object.entries(request).filter(([, value]) => value !== undefined)
  );
}
