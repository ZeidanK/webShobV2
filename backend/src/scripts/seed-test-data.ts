import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Company } from '../models/company.model';
import { config } from '../config';

async function seedTestData() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');

    // Create test company
    const existingCompany = await Company.findOne({ name: 'Test Company' });
    let company;
    
    if (existingCompany) {
      console.log('Test company already exists:', existingCompany.name);
      company = existingCompany;
    } else {
      company = await Company.create({
        name: 'Test Company',
        type: 'standard',
        status: 'active',
        settings: {
          allowCitizenReports: true,
          requireReportVerification: true,
          maxUsers: 100,
        },
      });
      console.log('Created test company:', company.name, 'ID:', company._id);
    }

    // Create super admin user
    const existingAdmin = await User.findOne({ email: 'admin@test.com' });
    
    if (existingAdmin) {
      console.log('Super admin already exists:', existingAdmin.email);
    } else {
      const admin = await User.create({
        email: 'admin@test.com',
        password: 'Admin123!',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'super_admin',
        companyId: company._id,
        isActive: true,
      });
      console.log('Created super admin:', admin.email);
    }

    // Create regular admin user
    const existingRegularAdmin = await User.findOne({ email: 'companyadmin@test.com' });
    
    if (existingRegularAdmin) {
      console.log('Company admin already exists:', existingRegularAdmin.email);
    } else {
      const regularAdmin = await User.create({
        email: 'companyadmin@test.com',
        password: 'Admin123!',
        firstName: 'Company',
        lastName: 'Admin',
        role: 'company_admin',
        companyId: company._id,
        isActive: true,
      });
      console.log('Created company admin:', regularAdmin.email);
    }

    // Create operator user
    const existingOperator = await User.findOne({ email: 'operator@test.com' });
    
    if (existingOperator) {
      console.log('Operator already exists:', existingOperator.email);
    } else {
      const operator = await User.create({
        email: 'operator@test.com',
        password: 'Operator123!',
        firstName: 'Test',
        lastName: 'Operator',
        role: 'operator',
        companyId: company._id,
        isActive: true,
      });
      console.log('Created operator:', operator.email);
    }

    console.log('\n=== Test Data Summary ===');
    console.log('Company ID:', company._id);
    console.log('\nTest Users:');
    console.log('1. Super Admin:');
    console.log('   Email: admin@test.com');
    console.log('   Password: Admin123!');
    console.log('   Role: super_admin');
    console.log('\n2. Company Admin:');
    console.log('   Email: companyadmin@test.com');
    console.log('   Password: Admin123!');
    console.log('   Role: company_admin');
    console.log('\n3. Operator:');
    console.log('   Email: operator@test.com');
    console.log('   Password: Operator123!');
    console.log('   Role: operator');

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error seeding test data:', error);
    process.exit(1);
  }
}

seedTestData();
