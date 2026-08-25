import fs from 'fs';
import path from 'path';

/**
 * Script to configure native Android resources for each BUKKIT flavor.
 * Generates AAPT2-compliant Android Adaptive Icons, Vector Drawables,
 * colors.xml, strings.xml, and notification status-bar icons.
 */

const FLAVORS = {
  customer: {
    name: 'BUKKIT',
    primaryColor: '#16a34a', // Emerald Green
    secondaryColor: '#22c55e',
    badgeText: 'FOOD',
    scheme: 'bukkit',
    channel: 'bukkit_order_updates',
    packageId: 'com.faratech.bukkit.customer',
    // Food/Shopping bag vector icon
    vectorPath: 'M54,20 C46.27,20 40,26.27 40,34 L40,38 L28,38 C25.79,38 24,39.79 24,42 L24,80 C24,84.42 27.58,88 32,88 L76,88 C80.42,88 84,84.42 84,80 L84,42 C84,39.79 82.21,38 80,38 L68,38 L68,34 C68,26.27 61.73,20 54,20 Z M54,28 C57.31,28 60,30.69 60,34 L60,38 L48,38 L48,34 C48,30.69 50.69,28 54,28 Z M36,46 C37.66,46 39,47.34 39,49 C39,50.66 37.66,52 36,52 C34.34,52 33,50.66 33,49 C33,47.34 34.34,46 36,46 Z M72,46 C73.66,46 75,47.34 75,49 C75,50.66 73.66,52 72,52 C70.34,52 69,50.66 69,49 C69,47.34 70.34,46 72,46 Z'
  },
  vendor: {
    name: 'BUKKIT Kitchen',
    primaryColor: '#d97706', // Amber/Orange
    secondaryColor: '#f59e0b',
    badgeText: 'CHEF',
    scheme: 'bukkit-vendor',
    channel: 'bukkit_kitchen_orders',
    packageId: 'com.faratech.bukkit.vendor',
    // Chef hat / Restaurant vector icon
    vectorPath: 'M54,22 C44,22 36,29 36,37 C33,37 30,40 30,44 C30,48 33,51 37,52 L37,70 C37,72.21 38.79,74 41,74 L67,74 C69.21,74 71,72.21 71,70 L71,52 C75,51 78,48 78,44 C78,40 75,37 72,37 C72,29 64,22 54,22 Z M42,78 L66,78 C68.21,78 70,79.79 70,82 C70,84.21 68.21,86 66,86 L42,86 C39.79,86 38,84.21 38,82 C38,79.79 39.79,78 42,78 Z'
  },
  rider: {
    name: 'BUKKIT Rider',
    primaryColor: '#0284c7', // Sky Blue
    secondaryColor: '#38bdf8',
    badgeText: 'RIDER',
    scheme: 'bukkit-rider',
    channel: 'bukkit_delivery_dispatches',
    packageId: 'com.faratech.bukkit.rider',
    // Scooter / Fast Delivery vector icon
    vectorPath: 'M76,64 C70.48,64 66,68.48 66,74 C66,79.52 70.48,84 76,84 C81.52,84 86,79.52 86,74 C86,68.48 81.52,64 76,64 Z M32,64 C26.48,64 22,68.48 22,74 C22,79.52 26.48,84 32,84 C37.52,84 42,79.52 42,74 C42,68.48 37.52,64 32,64 Z M68,36 L56,36 L52,48 L64,48 L68,36 Z M78,32 L66,32 L60,48 L46,48 C43.79,48 42,49.79 42,52 L42,58 L62,58 L68,40 L78,40 C80.21,40 82,38.21 82,36 C82,33.79 80.21,32 78,32 Z M32,54 C26,54 22,58 22,64 L28,64 C28,61.79 29.79,60 32,60 C34.21,60 36,61.79 36,64 L50,64 L46,54 L32,54 Z'
  },
  admin: {
    name: 'BUKKIT Admin',
    primaryColor: '#7c3aed', // Purple
    secondaryColor: '#a855f7',
    badgeText: 'ADMIN',
    scheme: 'bukkit-admin',
    channel: 'bukkit_ops_alerts',
    packageId: 'com.faratech.bukkit.admin',
    // Shield / Star vector icon
    vectorPath: 'M54,18 L26,30 L26,52 C26,70 38,85 54,90 C70,85 82,70 82,52 L82,30 L54,18 Z M54,34 L58,45 L70,45 L60,53 L64,64 L54,57 L44,64 L48,53 L38,45 L50,45 L54,34 Z'
  }
};

const targetFlavor = process.argv[2] || process.env.VITE_BUKKIT_APP_VARIANT || 'customer';
const config = FLAVORS[targetFlavor] || FLAVORS.customer;

console.log(`[Flavor Customizer] Configuring native Android resources for: ${targetFlavor} (${config.name})...`);

const resDir = path.resolve('android/app/src/main/res');

if (fs.existsSync(resDir)) {
  try {
    // 1. Configure values/colors.xml
    const valuesDir = path.join(resDir, 'values');
    if (!fs.existsSync(valuesDir)) fs.mkdirSync(valuesDir, { recursive: true });

    const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">${config.primaryColor}</color>
    <color name="colorPrimaryDark">${config.primaryColor}</color>
    <color name="colorAccent">${config.secondaryColor}</color>
</resources>`;
    fs.writeFileSync(path.join(valuesDir, 'colors.xml'), colorsXml, 'utf8');

    // 2. Configure values/strings.xml
    const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${config.name}</string>
    <string name="title_activity_main">${config.name}</string>
    <string name="package_name">${config.packageId}</string>
    <string name="custom_url_scheme">${config.scheme}</string>
    <string name="default_notification_channel_id">${config.channel}</string>
</resources>`;
    fs.writeFileSync(path.join(valuesDir, 'strings.xml'), stringsXml, 'utf8');

    // 3. Configure values/ic_launcher_background.xml
    const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${config.primaryColor}</color>
</resources>`;
    fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), bgXml, 'utf8');

    // 4. Configure valid Android Vector Drawable for ic_launcher_foreground.xml & ic_stat_bukkit.xml
    const drawableV24Dir = path.join(resDir, 'drawable-v24');
    const drawableDir = path.join(resDir, 'drawable');
    if (!fs.existsSync(drawableV24Dir)) fs.mkdirSync(drawableV24Dir, { recursive: true });
    if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });

    const foregroundVectorXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="${config.vectorPath}" />
</vector>`;

    fs.writeFileSync(path.join(drawableDir, 'ic_launcher_foreground.xml'), foregroundVectorXml, 'utf8');
    fs.writeFileSync(path.join(drawableV24Dir, 'ic_launcher_foreground.xml'), foregroundVectorXml, 'utf8');

    // Notification Status Bar Silhouette Icon (Monochrome vector required by Android notification manager)
    const notificationIconXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="${config.vectorPath}" />
</vector>`;

    fs.writeFileSync(path.join(drawableDir, 'ic_stat_bukkit.xml'), notificationIconXml, 'utf8');
    fs.writeFileSync(path.join(drawableV24Dir, 'ic_stat_bukkit.xml'), notificationIconXml, 'utf8');

    // 5. Configure mipmap-anydpi-v26/ic_launcher.xml & ic_launcher_round.xml
    const mipmapAnyDpi = path.join(resDir, 'mipmap-anydpi-v26');
    if (!fs.existsSync(mipmapAnyDpi)) fs.mkdirSync(mipmapAnyDpi, { recursive: true });

    const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>`;

    fs.writeFileSync(path.join(mipmapAnyDpi, 'ic_launcher.xml'), adaptiveIconXml, 'utf8');
    fs.writeFileSync(path.join(mipmapAnyDpi, 'ic_launcher_round.xml'), adaptiveIconXml, 'utf8');

    // 6. Ensure android/app/build.gradle has the exact applicationId for this flavor
    const appGradlePath = path.resolve('android/app/build.gradle');
    if (fs.existsSync(appGradlePath)) {
      let gradleContent = fs.readFileSync(appGradlePath, 'utf8');
      gradleContent = gradleContent.replace(/applicationId\s*=\s*\(?[^)\n]*\)?/g, `applicationId = "${config.packageId}"`);
      gradleContent = gradleContent.replace(/applicationId\s+"[^"]+"/g, `applicationId "${config.packageId}"`);
      fs.writeFileSync(appGradlePath, gradleContent, 'utf8');
      console.log(`[Flavor Customizer] Updated android/app/build.gradle applicationId to: ${config.packageId}`);
    }

    console.log(`[Flavor Customizer] Successfully generated valid Android AAPT2 resources and notification icons for ${config.name}.`);
  } catch (err) {
    console.warn('[Flavor Customizer] Resource configuration notice:', err.message);
  }
} else {
  console.log(`[Flavor Customizer] Note: res directory ${resDir} does not exist yet (will be populated during Capacitor sync).`);
}
