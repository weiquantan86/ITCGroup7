export const password = "ITCGROUPSEVEN7";

export const adminAccessCookieName = "admin_access";
export const adminAccessCookieValue = "granted";

export const hasAdminAccess = (cookieValue?: string | null) =>
  cookieValue === adminAccessCookieValue;

