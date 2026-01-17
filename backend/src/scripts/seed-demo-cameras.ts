/**
 * Seed Demo Cameras Script
 * 
 * Creates demo company, admin user, VMS server, and test camera.
 * Run with: npm run seed:demo
 */

import mongoose from 'mongoose';
import { config } from '../config';
import { Company } from '../models/company.model';
import { User, UserRole } from '../models/user.model';
import { VmsServer } from '../models/vms-server.model';
import { Camera } from '../models/camera.model';

async function seedDemoCameras() {
  console.log('🎥 Starting demo camera seed...\n');

  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri);
    console.log('✓ Connected to MongoDB');

    // Find or create demo company
    let company = await Company.findOne({ name: 'Demo Company' });
    if (!company) {
      company = await Company.create({
        name: 'Demo Company',
        status: 'active',
        settings: {
          allowCitizenReports: true,
          autoLinkReportsToEvents: true,
          maxUsers: 50,
          features: ['cameras', 'events', 'reports'],
        },
      });
      console.log('✓ Created Demo Company');
    } else {
      console.log('✓ Using existing Demo Company');
    }

    // Find or create demo admin user
    let adminUser = await User.findOne({ email: 'admin@demo.local' });
    if (!adminUser) {
      adminUser = await User.create({
        email: 'admin@demo.local',
        password: 'admin123',
        firstName: 'Demo',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        companyId: company._id,
      });
      console.log('✓ Created Admin User (admin@demo.local / admin123)');
    } else {
      console.log('✓ Using existing Admin User');
    }

    // Find or create demo operator user
    let operatorUser = await User.findOne({ email: 'operator@demo.local' });
    if (!operatorUser) {
      operatorUser = await User.create({
        email: 'operator@demo.local',
        password: 'operator123',
        firstName: 'Demo',
        lastName: 'Operator',
        role: UserRole.OPERATOR,
        companyId: company._id,
      });
      console.log('✓ Created Operator User (operator@demo.local / operator123)');
    } else {
      console.log('✓ Using existing Operator User');
    }

    // Create or update VMS server
    let vmsServer = await VmsServer.findOne({ 
      name: 'Demo Shinobi Server',
      companyId: company._id,
    });
    
    if (!vmsServer) {
      vmsServer = await VmsServer.create({
        companyId: company._id,
        name: 'Demo Shinobi Server',
        provider: 'shinobi',
        baseUrl: 'http://localhost:8080',
        isActive: true,
        auth: {
          apiKey: 'demo_api_key',
          groupKey: 'demo_group',
        },
        createdBy: adminUser._id,
      });
      console.log('✓ Created VMS Server');
    } else {
      console.log('✓ Using existing VMS Server');
    }

    // Create test camera with public stream
    const existingCamera = await Camera.findOne({
      name: 'Parking Lot Camera',
      companyId: company._id,
    });

    if (!existingCamera) {
      await Camera.create({
        name: 'Parking Lot Camera',
        description: 'Test camera with public HLS stream',
        type: 'ip',
        status: 'online',
        companyId: company._id,
        location: {
          type: 'Point',
          coordinates: [34.7825, 32.0860], // Tel Aviv
          address: 'Main Parking Lot, Tel Aviv',
        },
        streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        vms: {
          provider: 'shinobi',
          serverId: vmsServer._id,
        },
        settings: {
          recordingEnabled: true,
          fps: 30,
          resolution: '1920x1080',
        },
        createdBy: adminUser._id,
      });
      console.log('✓ Created Test Camera');
    } else {
      console.log('✓ Using existing Test Camera');
    }

    console.log('\n========================================');
    console.log('✅ Seed completed successfully!');
    console.log('========================================');
    console.log('\n📱 Admin Login:');
    console.log('   URL: http://localhost:5173');
    console.log('   Email: admin@demo.local');
    console.log('   Password: admin123');
    console.log('   Role: Can manage all cameras');
    console.log('\n👤 Operator Login:');
    console.log('   URL: http://localhost:5173');
    console.log('   Email: operator@demo.local');
    console.log('   Password: operator123');
    console.log('   Role: Can create/edit cameras (cannot delete)');
    console.log('\n🎥 Test Camera:');
    console.log('   A demo camera with public HLS stream is available');
    console.log('   Both users can view and manage it');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB\n');
  }
}

seedDemoCameras();
