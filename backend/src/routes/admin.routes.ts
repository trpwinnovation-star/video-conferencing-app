import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware';
import { listUsers, createUser, deleteUser } from '../controllers/admin.controller';

const router = Router();

// Apply the admin middleware to all routes below
router.use(requireAdmin);

// Admin operations
router.get('/users', listUsers);
router.post('/users', createUser);
router.delete('/users/:id', deleteUser);

export default router;
