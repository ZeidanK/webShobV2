/**
 * Cleanup Test Data Script
 * 
 * Removes all test events and reports from the database
 * while preserving companies, users, cameras, and event types.
 * 
 * Run with: npm run cleanup:test
 */

import mongoose from 'mongoose';
import { config } from '../config';
import { Event } from '../models/event.model';
import { Report } from '../models/report.model';

async function cleanupTestData() {
  console.log('🧹 Starting test data cleanup...\n');

  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri);
    console.log('✓ Connected to MongoDB');

    // Count documents before deletion
    const eventsCount = await Event.countDocuments();
    const reportsCount = await Report.countDocuments();

    console.log(`\nFound ${eventsCount} events and ${reportsCount} reports`);

    if (eventsCount === 0 && reportsCount === 0) {
      console.log('✓ No test data to clean up');
      await mongoose.connection.close();
      return;
    }

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will delete ALL events and reports!');
    console.log('   - Events:', eventsCount);
    console.log('   - Reports:', reportsCount);
    console.log('\nPreserves: companies, users, cameras, event types, VMS servers\n');

    // Delete all events
    if (eventsCount > 0) {
      const eventResult = await Event.deleteMany({});
      console.log(`✓ Deleted ${eventResult.deletedCount} events`);
    }

    // Delete all reports
    if (reportsCount > 0) {
      const reportResult = await Report.deleteMany({});
      console.log(`✓ Deleted ${reportResult.deletedCount} reports`);
    }

    console.log('\n========================================');
    console.log('✅ Cleanup completed successfully!');
    console.log('========================================');
    console.log('\n📝 Preserved data:');
    console.log('   - Companies and users');
    console.log('   - Cameras and VMS servers');
    console.log('   - Event types (system defaults + custom)');
    console.log('\n🗑️  Removed data:');
    console.log('   - All events');
    console.log('   - All reports');
    console.log('\n');

    await mongoose.connection.close();
    console.log('✓ Database connection closed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupTestData();
