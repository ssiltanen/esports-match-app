import { NextFunction, Request, Response } from 'express'

const errors: { [key: number]: string } = {
  400: "Bad Request",
  401: "Unauthenticated",
  403: "Unauthorized",
}

export default (error: number, _req: Request, res: Response, _next: NextFunction) => {
  const errorDescription = errors[error]
  errorDescription
    ? res.status(error).json({ error: errorDescription })
    : res.status(500).json({ error: 'Internal Server Error' })
}
