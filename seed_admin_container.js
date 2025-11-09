const bcrypt = require('bcrypt');

async function seedAdmin() {
  const adminEmail = 'admin@encore.com';
  const adminPassword = 'Password123!';
  
  console.log(`🌱 Iniciando sembrado de cuenta ADMIN para: ${adminEmail}...`);
  
  try {
    // Hashear la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
    
    console.log('Hash generado:', hashedPassword);
    console.log('✅ Hash generado exitosamente');
    console.log('👉 Ahora puedes usar este hash para actualizar el usuario en la base de datos');
    
  } catch (error) {
    console.error('❌ Error al generar hash:', error);
    process.exit(1);
  }
}

seedAdmin();