import express from 'express'
import errorHandler from './errorHandler'

export const apiRouter = express.Router()
// apiRouter.use('/api/slack/events', async (req: Request, res: Response, _next: NextFunction) => {
    
//   })

apiRouter.use(errorHandler)
