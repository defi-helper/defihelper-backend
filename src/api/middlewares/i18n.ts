import { Request, Response, NextFunction } from 'express';
import container from '@container';
import { I18n } from '@services/I18n';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare global {
  namespace Express {
    export interface Request {
      i18n: I18n;
    }
  }
}

export async function i18n(req: Request, res: Response, next: NextFunction) {
  req.i18n = container.i18n.byUser(req.currentUser);

  return next();
}
