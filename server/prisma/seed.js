/**
 * ResQ — demo seed.
 *
 * EVERY record created here is written with sourceType DEMO. That is the whole
 * point: the freshness engine maps DEMO to a DEMO badge regardless of how
 * recently the row was written, so seeded data can never be mistaken for a
 * live availability claim (master prompt §41, §68, §72).
 *
 * Facility names are fictional. Coordinates are real city areas so that
 * distance and radius filtering behave realistically during a demo.
 *
 *   node prisma/seed.js
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'ResQDemo!2026';

const DEPARTMENTS = [
  ['Emergency', 'emergency'],
  ['Cardiology', 'cardiology'],
  ['Orthopaedics', 'orthopaedics'],
  ['Paediatrics', 'paediatrics'],
  ['Neurology', 'neurology'],
  ['General Medicine', 'general-medicine'],
  ['Obstetrics & Gynaecology', 'obstetrics-gynaecology'],
  ['Trauma & Burns', 'trauma-burns'],
  ['Oncology', 'oncology'],
  ['Nephrology', 'nephrology'],
];

const SERVICES = [
  ['24x7 Emergency', 'emergency-24x7'],
  ['Ambulance', 'ambulance'],
  ['ICU', 'icu'],
  ['Ventilator Support', 'ventilator'],
  ['Blood Bank', 'blood-bank'],
  ['Dialysis', 'dialysis'],
  ['CT Scan', 'ct-scan'],
  ['MRI', 'mri'],
  ['X-Ray', 'x-ray'],
  ['Pharmacy', 'pharmacy'],
  ['Pathology Lab', 'pathology'],
  ['Maternity', 'maternity'],
  ['Trauma Care', 'trauma-care'],
  ['Cath Lab', 'cath-lab'],
  ['Wheelchair Access', 'wheelchair-access'],
];

/** [name, type, city, lat, lng, hasEmergency, verification] */
const FACILITIES = [
  // --- Jaipur ---
  ['Aravalli City Hospital', 'PRIVATE_HOSPITAL', 'Jaipur', 26.9124, 75.7873, true, 'VERIFIED'],
  ['Pink City General Hospital', 'GOVERNMENT_HOSPITAL', 'Jaipur', 26.9239, 75.8267, true, 'VERIFIED'],
  ['Mansarovar Trauma Centre', 'TRAUMA_CENTER', 'Jaipur', 26.8505, 75.7628, true, 'VERIFIED'],
  ['Jal Mahal Emergency Care', 'EMERGENCY_CENTER', 'Jaipur', 26.9535, 75.8460, true, 'PENDING_REVIEW'],
  ['Shastri Nagar Clinic', 'CLINIC', 'Jaipur', 26.9407, 75.7900, false, 'UNVERIFIED'],
  ['Amber Diagnostics', 'DIAGNOSTIC_CENTER', 'Jaipur', 26.9855, 75.8513, false, 'VERIFIED'],
  ['Vaishali Nagar Medical Centre', 'PRIVATE_HOSPITAL', 'Jaipur', 26.9115, 75.7390, true, 'VERIFIED'],
  ['Malviya Nagar Childrens Hospital', 'PRIVATE_HOSPITAL', 'Jaipur', 26.8536, 75.8065, true, 'PENDING_REVIEW'],
  ['Chandpole Community Clinic', 'CLINIC', 'Jaipur', 26.9270, 75.8085, false, 'UNVERIFIED'],
  ['Sanganer Blood Bank', 'BLOOD_BANK', 'Jaipur', 26.8192, 75.7920, false, 'VERIFIED'],
  ['Tonk Road Pharmacy', 'PHARMACY', 'Jaipur', 26.8780, 75.8010, false, 'UNVERIFIED'],
  ['Rajasthan Ambulance Network', 'AMBULANCE_PROVIDER', 'Jaipur', 26.9000, 75.8000, false, 'VERIFIED'],
  ['Jagatpura Multispeciality', 'PRIVATE_HOSPITAL', 'Jaipur', 26.8200, 75.8460, true, 'VERIFIED'],
  ['Civil Lines Government Hospital', 'GOVERNMENT_HOSPITAL', 'Jaipur', 26.9070, 75.7960, true, 'VERIFIED'],

  // --- Delhi ---
  ['Yamuna Bank General Hospital', 'GOVERNMENT_HOSPITAL', 'Delhi', 28.6200, 77.2770, true, 'VERIFIED'],
  ['Connaught Emergency Centre', 'EMERGENCY_CENTER', 'Delhi', 28.6315, 77.2167, true, 'VERIFIED'],
  ['Saket Trauma Institute', 'TRAUMA_CENTER', 'Delhi', 28.5245, 77.2066, true, 'VERIFIED'],
  ['Rohini Community Hospital', 'PRIVATE_HOSPITAL', 'Delhi', 28.7410, 77.0660, true, 'PENDING_REVIEW'],
  ['Dwarka Family Clinic', 'CLINIC', 'Delhi', 28.5921, 77.0460, false, 'UNVERIFIED'],
  ['Lajpat Nagar Diagnostics', 'DIAGNOSTIC_CENTER', 'Delhi', 28.5677, 77.2433, false, 'VERIFIED'],
  ['Karol Bagh Blood Bank', 'BLOOD_BANK', 'Delhi', 28.6519, 77.1900, false, 'VERIFIED'],
  ['Vasant Kunj Multispeciality', 'PRIVATE_HOSPITAL', 'Delhi', 28.5200, 77.1590, true, 'VERIFIED'],
  ['Shahdara Pharmacy & Clinic', 'PHARMACY', 'Delhi', 28.6730, 77.2890, false, 'UNVERIFIED'],
  ['Capital Ambulance Services', 'AMBULANCE_PROVIDER', 'Delhi', 28.6400, 77.2200, false, 'VERIFIED'],
];

const AVAILABILITY_PATTERN = [
  // [resourceType, status, count, ageMinutes]
  // Varied ages so the UI shows RECENT, STALE and UNKNOWN side by side.
  ['EMERGENCY_DEPARTMENT', 'AVAILABLE', null, 8],
  ['GENERAL_BED', 'LIMITED', 6, 25],
  ['ICU_BED', 'FULL', 0, 40],
  ['VENTILATOR', 'LIMITED', 2, 190], // deliberately STALE
  ['AMBULANCE', 'AVAILABLE', 3, 15],
];

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);

async function main() {
  console.log('Seeding ResQ demo data...');

  // Idempotent: wipe in FK-safe order so the script can be re-run.
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.emergencySession.deleteMany();
  await prisma.savedFacility.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.bloodInventory.deleteMany();
  await prisma.bloodBank.deleteMany();
  await prisma.ambulance.deleteMany();
  await prisma.facilityAvailability.deleteMany();
  await prisma.operatingHour.deleteMany();
  await prisma.facilityDepartment.deleteMany();
  await prisma.facilityService.deleteMany();
  await prisma.facilityAdmin.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.department.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
  await prisma.dataSource.deleteMany();

  const dataSource = await prisma.dataSource.create({
    data: {
      name: 'ResQ Demo Dataset',
      type: 'DEMO',
      reliability: 0,
      url: null,
    },
  });

  const departments = await Promise.all(
    DEPARTMENTS.map(([name, slug]) => prisma.department.create({ data: { name, slug } })),
  );
  const services = await Promise.all(
    SERVICES.map(([name, slug]) => prisma.service.create({ data: { name, slug } })),
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const [user, hospitalAdmin, superAdmin, secondAdmin] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Demo User',
        email: 'user@demo.resq',
        phone: '+91 90000 00001',
        passwordHash,
        role: 'USER',
        preferredCity: 'Jaipur',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Demo Hospital Admin',
        email: 'hospital@demo.resq',
        phone: '+91 90000 00002',
        passwordHash,
        role: 'HOSPITAL_ADMIN',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Demo Super Admin',
        email: 'admin@demo.resq',
        phone: '+91 90000 00003',
        passwordHash,
        role: 'SUPER_ADMIN',
      },
    }),
    // Exists so the ownership test has a second admin to be refused as.
    prisma.user.create({
      data: {
        name: 'Second Hospital Admin',
        email: 'hospital2@demo.resq',
        passwordHash,
        role: 'HOSPITAL_ADMIN',
      },
    }),
  ]);

  const created = [];
  for (const [name, type, city, latitude, longitude, hasEmergency, verificationStatus] of FACILITIES) {
    const facility = await prisma.facility.create({
      data: {
        name,
        type,
        city,
        state: city === 'Jaipur' ? 'Rajasthan' : 'Delhi',
        address: `${name}, ${city}`,
        latitude,
        longitude,
        phone: '+91 141 400 0000',
        emergencyPhone: hasEmergency ? '+91 141 400 0100' : null,
        hasEmergency,
        verificationStatus,
        sourceType: 'DEMO',
        dataSourceId: dataSource.id,
        description: 'Demo record created by prisma/seed.js. Not a real facility.',
        lastUpdatedAt: minutesAgo(30),
      },
    });
    created.push(facility);

    // Departments: emergency facilities always get Emergency, plus a rotating slice.
    const picked = new Set();
    if (hasEmergency) picked.add(departments[0].id);
    for (let i = 0; i < 3; i += 1) {
      picked.add(departments[(created.length * 3 + i) % departments.length].id);
    }
    await prisma.facilityDepartment.createMany({
      data: [...picked].map((departmentId) => ({ facilityId: facility.id, departmentId })),
    });

    const pickedServices = new Set();
    for (let i = 0; i < 4; i += 1) {
      pickedServices.add(services[(created.length * 4 + i) % services.length].id);
    }
    await prisma.facilityService.createMany({
      data: [...pickedServices].map((serviceId) => ({ facilityId: facility.id, serviceId })),
    });

    // Hours: emergency facilities 24/7, everything else 08:00-20:00 with Sunday closed.
    await prisma.operatingHour.createMany({
      data: Array.from({ length: 7 }, (_, day) => ({
        facilityId: facility.id,
        dayOfWeek: day,
        is24Hours: hasEmergency,
        isClosed: !hasEmergency && day === 0,
        openTime: hasEmergency ? null : day === 0 ? null : '08:00',
        closeTime: hasEmergency ? null : day === 0 ? null : '20:00',
      })),
    });

    // Availability only where it makes sense. A pharmacy reporting ICU beds
    // would be nonsense, and the fifth facility gets NOTHING on purpose so the
    // "no information" path is visible in the demo.
    if (hasEmergency && created.length % 5 !== 0) {
      await prisma.facilityAvailability.createMany({
        data: AVAILABILITY_PATTERN.map(([resourceType, status, count, age]) => ({
          facilityId: facility.id,
          resourceType,
          status,
          count,
          sourceType: 'DEMO',
          dataSourceId: dataSource.id,
          lastUpdatedAt: minutesAgo(age + (created.length % 7) * 3),
        })),
      });
    }

    if (verificationStatus === 'VERIFIED') {
      await prisma.verification.create({
        data: {
          facilityId: facility.id,
          status: 'VERIFIED',
          sourceType: 'DEMO',
          reviewedById: superAdmin.id,
          reviewedAt: minutesAgo(60 * 24 * 7),
          notes: 'Demo verification record.',
        },
      });
    }
  }

  // Two facilities for the first admin (so the facility switcher has something
  // to switch), one for the second (so the 403 test has a real target).
  await prisma.facilityAdmin.createMany({
    data: [
      { userId: hospitalAdmin.id, facilityId: created[0].id },
      { userId: hospitalAdmin.id, facilityId: created[1].id },
      { userId: secondAdmin.id, facilityId: created[2].id },
    ],
  });

  // Blood banks: one attached to a facility, one standalone — the case that
  // forced BloodBank.facilityId to be nullable.
  const bbFacility = created.find((f) => f.type === 'BLOOD_BANK');
  const bloodBanks = await Promise.all([
    prisma.bloodBank.create({
      data: {
        facilityId: bbFacility?.id ?? null,
        name: 'Sanganer Blood Bank',
        address: 'Sanganer, Jaipur',
        city: 'Jaipur',
        latitude: 26.8192,
        longitude: 75.792,
        phone: '+91 141 400 0200',
        verificationStatus: 'VERIFIED',
        sourceType: 'DEMO',
      },
    }),
    prisma.bloodBank.create({
      data: {
        facilityId: null, // standalone
        name: 'Rajasthan Voluntary Blood Centre',
        address: 'C-Scheme, Jaipur',
        city: 'Jaipur',
        latitude: 26.9045,
        longitude: 75.8005,
        phone: '+91 141 400 0300',
        verificationStatus: 'VERIFIED',
        sourceType: 'DEMO',
      },
    }),
  ]);

  const groups = ['A_POS', 'A_NEG', 'B_POS', 'O_POS', 'O_NEG', 'AB_POS'];
  const statuses = ['AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'UNKNOWN'];
  for (const bank of bloodBanks) {
    await prisma.bloodInventory.createMany({
      data: groups.map((bloodGroup, i) => ({
        bloodBankId: bank.id,
        bloodGroup,
        component: 'WHOLE_BLOOD',
        status: statuses[i % statuses.length],
        sourceType: 'DEMO',
        lastUpdatedAt: minutesAgo(20 + i * 10),
      })),
      skipDuplicates: true,
    });
  }

  await prisma.ambulance.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({
      providerName: `Demo Ambulance Provider ${i + 1}`,
      phone: `+91 141 500 0${String(i).padStart(3, '0')}`,
      type: ['BASIC_LIFE_SUPPORT', 'ADVANCED_LIFE_SUPPORT', 'PATIENT_TRANSPORT'][i % 3],
      latitude: 26.88 + i * 0.012,
      longitude: 75.77 + i * 0.009,
      coverageArea: i < 6 ? 'Jaipur' : 'Delhi NCR',
      status: 'UNKNOWN', // directory information, never live dispatch
      verificationStatus: i % 2 === 0 ? 'VERIFIED' : 'UNVERIFIED',
      sourceType: 'DEMO',
    })),
  });

  await prisma.emergencyContact.createMany({
    data: [
      { userId: user.id, name: 'Demo Contact (Family)', phone: '+91 90000 11111', relationship: 'Brother', priority: 1 },
      { userId: user.id, name: 'Demo Contact (Friend)', phone: '+91 90000 22222', relationship: 'Friend', priority: 2 },
    ],
  });

  await prisma.report.create({
    data: {
      facilityId: created[4].id,
      reporterId: user.id,
      category: 'INCORRECT_PHONE',
      description: 'The listed phone number rings but is never answered. Demo report.',
    },
  });

  console.log(`  ${created.length} facilities`);
  console.log(`  ${departments.length} departments, ${services.length} services`);
  console.log(`  ${bloodBanks.length} blood banks, 10 ambulance providers`);
  console.log('\nDemo accounts (password for all: ' + DEMO_PASSWORD + ')');
  console.log('  user@demo.resq        USER');
  console.log('  hospital@demo.resq    HOSPITAL_ADMIN  (manages 2 facilities)');
  console.log('  hospital2@demo.resq   HOSPITAL_ADMIN  (manages 1 other facility)');
  console.log('  admin@demo.resq       SUPER_ADMIN');
  console.log('\nEvery record is sourceType DEMO and renders with a DEMO badge.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
