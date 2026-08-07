import { Router } from 'express';
import { runOperatorQuery } from '../llm/query.js';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { question } = req.body ?? {};
    const result = await runOperatorQuery(question);
    res.json({ question, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
