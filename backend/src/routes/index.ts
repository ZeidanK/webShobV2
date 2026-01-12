import { Router } from 'express';
import { healthRoutes } from './health.routes.js';

const router = Router();

// Mount route modules
router.use('/health', healthRoutes);

// Placeholder routes for future implementation
// router.use('/auth', authRoutes);        // Slice 1
// router.use('/companies', companyRoutes); // Slice 2
// router.use('/users', userRoutes);        // Slice 2
// router.use('/reports', reportRoutes);    // Slice 3
// router.use('/events', eventRoutes);      // Slice 4
// router.use('/event-types', eventTypeRoutes); // Slice 4
// router.use('/cameras', cameraRoutes);    // Slice 7
// router.use('/ai', aiRoutes);             // Slice 11

export const apiRoutes = router;
