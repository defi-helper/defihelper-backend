import { DataLoaderContainer } from '@api/dataLoader/container';
import { Request, Response, NextFunction } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare global {
  namespace Express {
    export interface Request {
      dataLoader: DataLoaderContainer;
    }
  }
}

export async function dataLoader(req: Request, res: Response, next: NextFunction) {
  req.dataLoader = new DataLoaderContainer({});

  return next();
}
