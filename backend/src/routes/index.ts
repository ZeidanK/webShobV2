import { Router } from 'express';
import { healthRoutes } from './health.routes';
import authRoutes from './auth.routes';
import companyRoutes from './company.routes';
import userRoutes from './user.routes';
import reportRoutes from './report.routes';
import { eventRoutes } from './event.routes';
import { eventTypeRoutes } from './event-type.routes';
import cameraRoutes from './camera.routes';
import vmsRoutes from './vms.routes';
import mobileRoutes from './mobile.routes';

const router = Router();

// Mount route modules
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/companies', companyRoutes); // Slice 2
router.use('/users', userRoutes);        // Slice 2
router.use('/reports', reportRoutes);    // Slice 3
router.use('/events', eventRoutes);      // Slice 4
router.use('/event-types', eventTypeRoutes); // Slice 4
router.use('/cameras', cameraRoutes);    // Slice 9.0: Camera Management
router.use('/vms', vmsRoutes);           // Slice 9.0: VMS Integration
router.use('/mobile', mobileRoutes);     // Slice 7: Mobile API Integration
// router.use('/ai', aiRoutes);             // Slice 11

export const apiRoutes = router;
