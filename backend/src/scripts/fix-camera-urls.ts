/**
 * Fix camera stream URLs - replace shinobi:8080 with localhost:8080
 */

import mongoose from 'mongoose';
import { Camera } from '../models';
import { config } from '../config';

async function fixCameraUrls() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');

    const cameras = await Camera.find({ 
      streamUrl: { $regex: /^http:\/\/shinobi:/ } 
    });

    console.log(`Found ${cameras.length} cameras with shinobi URLs`);

    for (const camera of cameras) {
      const oldUrl = camera.streamUrl;
      const newUrl = oldUrl?.replace('http://shinobi:', 'http://localhost:');
      
      if (newUrl) {
        camera.streamUrl = newUrl;
        await camera.save();
        console.log(`Updated: ${camera.name}`);
        console.log(`  Old: ${oldUrl}`);
        console.log(`  New: ${newUrl}`);
      }
    }

    console.log('\n✅ Camera URLs updated successfully!');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixCameraUrls();
