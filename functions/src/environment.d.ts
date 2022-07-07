import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JWT_TOKEN_KEY: string;
    }
  }

  namespace Express {
    export interface Request {
      jwtPayload: JwtPayload;
    }
  }
}

export {};
