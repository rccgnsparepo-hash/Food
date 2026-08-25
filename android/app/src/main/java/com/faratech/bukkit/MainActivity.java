package com.faratech.bukkit;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "BUKKIT_NATIVE";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Setup defensive uncaught exception handler to log fatal errors and prevent silent termination
        setupSafetyExceptionHandler();

        super.onCreate(savedInstanceState);

        // Ensure FirebaseApp is fully initialized natively with google-services parameters
        ensureFirebaseInitialized();

        // Ensure Android Notification Channels exist at the system level
        createNativeNotificationChannels();
    }

    private void setupSafetyExceptionHandler() {
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread thread, Throwable throwable) {
                Log.e(TAG, "FATAL EXCEPTION in thread " + thread.getName() + ": " + throwable.getMessage(), throwable);
                if (defaultHandler != null) {
                    defaultHandler.uncaughtException(thread, throwable);
                }
            }
        });
    }

    private void ensureFirebaseInitialized() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                Log.i(TAG, "Initializing default FirebaseApp programmatically for package: " + getPackageName());
                String packageName = getPackageName();
                String appId = "1:737788701507:android:58cae400c951e61c8a9df6"; // default base

                if (packageName.contains("customer")) {
                    appId = "1:737788701507:android:4c0d3fb1cedfd5f28a9df6";
                } else if (packageName.contains("vendor")) {
                    appId = "1:737788701507:android:32c474ead27be9c48a9df6";
                } else if (packageName.contains("rider")) {
                    appId = "1:737788701507:android:51f7fab9df115cc78a9df6";
                } else if (packageName.contains("admin")) {
                    appId = "1:737788701507:android:c76d591224b871128a9df6";
                }

                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId(appId)
                    .setApiKey("AIzaSyCHCNm1k4ILYvKS77gnRnVSGwGXiytVdw8")
                    .setProjectId("bukkit-61aef")
                    .setGcmSenderId("737788701507")
                    .setDatabaseUrl("https://bukkit-61aef-default-rtdb.firebaseio.com")
                    .setStorageBucket("bukkit-61aef.firebasestorage.app")
                    .build();

                FirebaseApp.initializeApp(this, options);
                Log.i(TAG, "Explicit FirebaseApp initialization complete with AppID: " + appId);
            } else {
                Log.i(TAG, "FirebaseApp already initialized automatically via FirebaseInitProvider.");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing FirebaseApp natively", e);
        }
    }

    private void createNativeNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager == null) return;

                // 1. Order Updates Channel
                NotificationChannel orderChannel = new NotificationChannel(
                    "bukkit_order_updates",
                    "Order Updates & Tracking",
                    NotificationManager.IMPORTANCE_HIGH
                );
                orderChannel.setDescription("Real-time order progress alerts and delivery updates");
                orderChannel.enableLights(true);
                orderChannel.setLightColor(Color.parseColor("#16a34a"));
                orderChannel.enableVibration(true);
                manager.createNotificationChannel(orderChannel);

                // 2. Kitchen / Vendor Channel
                NotificationChannel kitchenChannel = new NotificationChannel(
                    "bukkit_kitchen_orders",
                    "Kitchen & Vendor Orders",
                    NotificationManager.IMPORTANCE_HIGH
                );
                kitchenChannel.setDescription("Incoming new orders and rider arrival alerts for kitchen stands");
                kitchenChannel.enableLights(true);
                kitchenChannel.setLightColor(Color.parseColor("#d97706"));
                kitchenChannel.enableVibration(true);
                manager.createNotificationChannel(kitchenChannel);

                // 3. Rider Channel
                NotificationChannel riderChannel = new NotificationChannel(
                    "bukkit_delivery_dispatches",
                    "Rider Delivery Dispatches",
                    NotificationManager.IMPORTANCE_HIGH
                );
                riderChannel.setDescription("New delivery assignments and customer arrival alerts for couriers");
                riderChannel.enableLights(true);
                riderChannel.setLightColor(Color.parseColor("#0284c7"));
                riderChannel.enableVibration(true);
                manager.createNotificationChannel(riderChannel);

                // 4. Admin Ops Channel
                NotificationChannel adminChannel = new NotificationChannel(
                    "bukkit_ops_alerts",
                    "Admin & Operations Alerts",
                    NotificationManager.IMPORTANCE_DEFAULT
                );
                adminChannel.setDescription("System health anomalies and operational alerts");
                adminChannel.enableLights(true);
                adminChannel.setLightColor(Color.parseColor("#7c3aed"));
                adminChannel.enableVibration(true);
                manager.createNotificationChannel(adminChannel);

                // 5. Messages Channel
                NotificationChannel messagesChannel = new NotificationChannel(
                    "messages",
                    "Chat & Messages",
                    NotificationManager.IMPORTANCE_HIGH
                );
                messagesChannel.setDescription("Direct communication between customers, riders, and kitchen");
                messagesChannel.enableVibration(true);
                manager.createNotificationChannel(messagesChannel);

                Log.i(TAG, "All 5 native Android Notification Channels created successfully.");
            } catch (Exception e) {
                Log.e(TAG, "Failed to create native notification channels", e);
            }
        }
    }
}
