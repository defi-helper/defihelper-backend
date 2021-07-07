import { Request, Response, NextFunction } from 'express';
import container from '@container';
import { ACL } from '@services/ACL';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare global {
  namespace Express {
    export interface Request {
      acl: ACL;
    }
  }
}

export async function acl(req: Request, res: Response, next: NextFunction) {
  req.acl = container.acl.byUser(req.currentUser);

  return next();
}
