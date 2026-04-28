
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: Role } & JwtPayload;
    }
  }
}

export {};