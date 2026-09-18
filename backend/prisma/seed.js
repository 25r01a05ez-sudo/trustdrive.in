/**
 * Seeds Postgres with the same demo data used by the in-memory store, so
 * behavior is identical whether TrustDrive is running in DEMO_MODE or
 * against a real database.
 *
 * NOTE: User records ARE the source of truth for auth here (custom JWT +
 * bcrypt, see routes/auth.js) -- passwords for these seed users are set
 * below via bcrypt.hash. This is not vestigial.
 *
 * Run with: npx prisma db seed   (after DATABASE_URL is set and migrated)
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const demoPasswordHash = await bcrypt.hash("password123", 10);

  const primeMotors = await prisma.dealer.upsert({
    where: { gstNumber: "36ABCDE1234F1Z5" },
    update: {},
    create: {
      name: "Prime Motors Hyderabad",
      gstNumber: "36ABCDE1234F1Z5",
      city: "Hyderabad",
      address: "Road No. 12, Banjara Hills",
      verificationStatus: "verified",
      verifiedAt: new Date(),
      kycDocs: ["gst_certificate.pdf", "dealer_license.pdf"],
      whatsapp: "+919876500002",
      rating: 4.6,
      reviewCount: 128,
      freeCreditsTotal: 5,
      freeCreditsUsed: 2,
    },
  });

  const srUsedCars = await prisma.dealer.upsert({
    where: { gstNumber: "36XYZAB5678K1Z9" },
    update: {},
    create: {
      name: "SR Used Cars",
      gstNumber: "36XYZAB5678K1Z9",
      city: "Hyderabad",
      address: "Kukatpally Housing Board",
      verificationStatus: "pending",
      kycDocs: ["gst_certificate.pdf"],
      whatsapp: "+919876500009",
      rating: 4.1,
      reviewCount: 34,
    },
  });

  const metroAuto = await prisma.dealer.upsert({
    where: { gstNumber: "36LMNOP9012Q1Z2" },
    update: {},
    create: {
      name: "Metro Auto Deals",
      gstNumber: "36LMNOP9012Q1Z2",
      city: "Secunderabad",
      address: "S.D. Road",
      verificationStatus: "verified",
      verifiedAt: new Date(),
      kycDocs: ["gst_certificate.pdf", "dealer_license.pdf", "shop_act.pdf"],
      whatsapp: "+919876500011",
      rating: 4.8,
      reviewCount: 212,
    },
  });

  await prisma.user.upsert({
    where: { email: "arjun@example.com" },
    update: {},
    create: { role: "buyer", name: "Arjun Rao", email: "arjun@example.com", phone: "9876500001", passwordHash: demoPasswordHash },
  });
  await prisma.user.upsert({
    where: { email: "farhan@primemotors.in" },
    update: {},
    create: { role: "dealer", name: "Farhan Sheikh", email: "farhan@primemotors.in", phone: "9876500002", passwordHash: demoPasswordHash, dealerId: primeMotors.id },
  });
  await prisma.user.upsert({
    where: { email: "admin@trustdrive.in" },
    update: {},
    create: { role: "admin", name: "Platform Admin", email: "admin@trustdrive.in", phone: "9876500000", passwordHash: demoPasswordHash },
  });

  const vehicles = [
    { dealerId: primeMotors.id, brand: "Maruti Suzuki", model: "Swift VXI", year: 2021, price: 620000, km: 28000, fuel: "Petrol", transmission: "Manual", owners: 1, chassisNumber: "MA3ERLF1SXXXXXXXX", registrationNumber: "TS09EA1234", rcVerified: true, verificationStatus: "verified", description: "Single-owner Swift, dealer-serviced, accident-free per RC & insurance check." },
    { dealerId: primeMotors.id, brand: "Hyundai", model: "Creta SX", year: 2020, price: 1150000, km: 41000, fuel: "Diesel", transmission: "Automatic", owners: 2, chassisNumber: "MALC381CLJMXXXXXX", registrationNumber: "TS07EB4521", rcVerified: true, verificationStatus: "verified", description: "Top-spec SX trim, sunroof, well maintained, all service records available." },
    { dealerId: metroAuto.id, brand: "Honda", model: "City ZX", year: 2022, price: 1340000, km: 15000, fuel: "Petrol", transmission: "CVT", owners: 1, chassisNumber: "MRHGM8670NPXXXXXX", registrationNumber: "TS10EC7788", rcVerified: true, verificationStatus: "verified", description: "Nearly new, under manufacturer warranty, VIN and RC cross-checked with VAHAN." },
    { dealerId: srUsedCars.id, brand: "Tata", model: "Nexon XZ+", year: 2019, price: 720000, km: 52000, fuel: "Diesel", transmission: "Manual", owners: 2, chassisNumber: "MAT625712KFXXXXXX", registrationNumber: "TS08ED3390", rcVerified: false, verificationStatus: "declined", description: "Well kept, minor scratches on rear bumper, RC check in progress." },
    { dealerId: metroAuto.id, brand: "Mahindra", model: "XUV700 AX7", year: 2023, price: 2150000, km: 8000, fuel: "Diesel", transmission: "Automatic", owners: 1, chassisNumber: "MA1UV2GH9PXXXXXXX", registrationNumber: "TS11EF6612", rcVerified: true, verificationStatus: "verified", description: "Flagship AX7 variant, ADAS pack, showroom condition." },
  ];

  for (const v of vehicles) {
    const exists = await prisma.vehicle.findFirst({ where: { registrationNumber: v.registrationNumber } });
    if (!exists) await prisma.vehicle.create({ data: v });
  }

  await prisma.review.createMany({
    data: [
      { dealerId: primeMotors.id, buyerName: "Priya", rating: 5, comment: "Smooth purchase, documents matched exactly what was promised." },
      { dealerId: metroAuto.id, buyerName: "Kiran", rating: 5, comment: "Verified badge gave me confidence, RC transfer handled well." },
    ],
    skipDuplicates: true,
  });

  // Demo coupon
  const existingCoupon = await prisma.coupon.findUnique({ where: { code: "FIRST500" } });
  if (!existingCoupon) {
    await prisma.coupon.create({
      data: {
        code: "FIRST500",
        discountType: "fixed",
        discountValue: 500,
        active: true,
        usageLimit: 10,
        usedCount: 0,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
