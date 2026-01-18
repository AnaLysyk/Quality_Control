export const permissions = {
  admin: {
    defect: ["create", "edit", "delete", "linkRun"],
    run: ["create", "linkDefect"],
  },
  company: {
    defect: ["create", "edit", "linkRun"],
    run: ["linkDefect"],
  },
  user: {
    defect: ["create", "linkRun"],
    run: [],
  },
};

export function can(userRole: string, resource: string, action: string) {
  return permissions[userRole]?.[resource]?.includes(action) ?? false;
}
