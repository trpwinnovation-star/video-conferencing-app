import { Router } from 'express';
import { register, login, logout, authRegister, authStatus, getMe, changePassword, forgotPassword, resetPassword, updateDefaultPassword } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/authRegister', authRegister);
router.post('/logout', logout);
router.get('/me', getMe);
router.put('/change-password', changePassword);
router.patch('/default-password', updateDefaultPassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
