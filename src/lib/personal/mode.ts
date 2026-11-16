export function isPersonalEdition() {
  return process.env.APP_MODE !== "saas";
}

export function personalFamilySlug() {
  const value = process.env.PERSONAL_FAMILY_SLUG?.trim();
  return value && /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(value) ? value : "demo-hong-viet";
}
