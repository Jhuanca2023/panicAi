const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

// Configuración nativa que react-native-health-connect necesita y que su
// plugin oficial NO agrega:
//
// 1) Registrar el "permission launcher" en MainActivity.onCreate. La librería
//    solo define HealthConnectPermissionDelegate.setPermissionDelegate pero no
//    lo llama; sin esto requestPermission crashea con "lateinit property
//    requestPermission has not been initialized".
//
// 2) En Android 14+ (API 34), Health Connect es parte del sistema y exige un
//    activity-alias que maneje VIEW_PERMISSION_USAGE; sin él, el sistema
//    DENIEGA el permiso al instante (sin mostrar la pantalla).

const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';
const ALIAS_NAME = 'ViewPermissionUsageActivity';

function withDelegateRegistration(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes(IMPORT)) {
      src = src.replace(/^(package .*)$/m, `$1\n\n${IMPORT}`);
    }
    if (!src.includes(CALL)) {
      src = src.replace(/(super\.onCreate\([^)]*\))/, `$1\n    ${CALL}`);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withPermissionUsageAlias(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;

    app['activity-alias'] = app['activity-alias'] || [];
    const exists = app['activity-alias'].some(
      (a) => a.$?.['android:name'] === ALIAS_NAME,
    );
    if (!exists) {
      app['activity-alias'].push({
        $: {
          'android:name': ALIAS_NAME,
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
      });
    }
    return cfg;
  });
}

module.exports = function withHealthConnectDelegate(config) {
  config = withDelegateRegistration(config);
  config = withPermissionUsageAlias(config);
  return config;
};
