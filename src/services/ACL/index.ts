export interface Permissions {
  [r: string]: string[];
}

export class ACL {
  static expand(parent: ACL, permissions: Permissions) {
    return new ACL(
      Object.entries(parent.permissions).reduce(
        (res, [resouce, permissions]) => ({
          ...res,
          [resouce]: [...(res[resouce] ?? []), ...permissions],
        }),
        permissions,
      ),
    );
  }

  constructor(public readonly permissions: Permissions = (permissions = {})) {}

  isAllowed(resource: string, permission: string) {
    return (this.permissions[resource] ?? []).includes(permission);
  }
}
