import {
  getStorageUsage,
  checkStorageQuotaGuard,
  formatBytes,
  STORAGE_MAX_LIMIT_GB,
  MAX_STORAGE_LIMIT_BYTES,
} from '../services/storage';

async function runStorageGuardTest() {
  console.log('🧪 Memulai pengujian Cloudflare R2 / MinIO Storage Guard...');
  console.log(`📌 Konfigurasi Kuota Batas: ${STORAGE_MAX_LIMIT_GB} GB (${MAX_STORAGE_LIMIT_BYTES.toLocaleString()} Bytes)\n`);

  try {
    // 1. Cek storage usage saat ini
    console.log('1️⃣ Memeriksa status penggunaan storage saat ini...');
    const usage = await getStorageUsage(true);
    console.log(`   Provider       : ${usage.provider}`);
    console.log(`   Bucket         : ${usage.bucket}`);
    console.log(`   Total Terpakai : ${usage.usedFormatted} (${usage.usedBytes.toLocaleString()} B)`);
    console.log(`   Batas Maksimal : ${usage.limitFormatted}`);
    console.log(`   Sisa Kapasitas : ${usage.remainingFormatted}`);
    console.log(`   Persentase     : ${usage.usagePercentage}%`);
    console.log(`   Total Objek    : ${usage.totalObjects} file\n`);

    // 2. Simulasi upload file wajar (misal: 2.5 MB)
    const normalFileSize = 2.5 * 1024 * 1024; // 2.5MB
    console.log(`2️⃣ Simulasi Guard untuk file wajar (${formatBytes(normalFileSize)})...`);
    const checkNormal = await checkStorageQuotaGuard(normalFileSize);
    if (checkNormal.allowed) {
      console.log('   ✅ PASS: File diperbolehkan untuk diunggah.');
    } else {
      console.log('   ❌ FAIL: File ditolak padahal masih di bawah limit.');
    }

    // 3. Simulasi upload file yang melebihi batas 8GB (misal: 8.5 GB)
    const oversizedFileSize = (STORAGE_MAX_LIMIT_GB + 0.5) * 1024 * 1024 * 1024;
    console.log(`\n3️⃣ Simulasi Guard untuk file melebihi batas 8GB (${formatBytes(oversizedFileSize)})...`);
    const checkOversized = await checkStorageQuotaGuard(oversizedFileSize);
    if (!checkOversized.allowed) {
      console.log('   ✅ PASS: Guard sukses memblokir unggahan berlebih!');
      console.log(`   Kode Error    : ${checkOversized.code}`);
      console.log(`   Feedback Pesan: "${checkOversized.error}"`);
    } else {
      console.log('   ❌ FAIL: File melebihi batas tidak diblokir!');
    }

    console.log('\n🎉 Semua skenario uji Storage Guard berhasil!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error saat pengujian storage guard:', error);
    process.exit(1);
  }
}

runStorageGuardTest();
