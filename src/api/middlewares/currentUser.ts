import { Request, Response, NextFunction } from 'express';
import container from '@container';
import { User } from '@models/User/Entity';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare global {
  namespace Express {
    export interface Request {
      currentUser?: User;
    }
  }
}

export async function currentUser(req: Request, res: Response, next: NextFunction) {
  const sid = req.header('Auth');
  if (!sid) return next();

  const userId = await container.model.sessionService().get(sid);
  if (!userId) return next();

  const user = await container.model.userTable().where('id', userId).first();
  if (!user) return next();

  req.currentUser = user;

  return next();
}
