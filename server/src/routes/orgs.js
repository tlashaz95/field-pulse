import { Router } from 'express';
import { buildDashboard, getDivision } from '../services/orgs.js';

const router = Router();

router.get('/division', async (_req, res, next) => {
  try {
    const division = await getDivision();
    if (!division) return res.status(404).json({ error: 'Division not seeded' });
    const dashboard = await buildDashboard(division.id);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/dashboard', async (req, res, next) => {
  try {
    const dashboard = await buildDashboard(req.params.id);
    if (!dashboard) return res.status(404).json({ error: 'Organisation not found' });
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

export default router;
