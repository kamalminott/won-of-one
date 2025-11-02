# App Icon Setup Guide

To set up the Won Of One logo as your app icon, you need to create the following images:

## Required Images

### 1. Main App Icon (1024×1024 px)
**File:** `assets/images/icon.png`
- **Size:** 1024×1024 pixels
- **Format:** PNG with transparency
- **Content:** Your Won Of One logo
- **Use:** App Store, iOS home screen, Android home screen

### 2. Splash Screen Icon (200×200 px or larger)
**File:** `assets/images/splash-icon.png`
- **Size:** At least 200×200 pixels (larger is better)
- **Format:** PNG with transparency
- **Content:** Your Won Of One logo
- **Use:** Splash screen when app launches

### 3. Android Adaptive Icon (1024×1024 px)
**File:** `assets/images/adaptive-icon.png`
- **Size:** 1024×1024 pixels
- **Format:** PNG with transparency
- **Content:** Your Won Of One logo
- **Use:** Android adaptive icon

### 4. Web Favicon (32×32 px or larger)
**File:** `assets/images/favicon.png`
- **Size:** At least 32×32 pixels
- **Format:** PNG or ICO
- **Content:** Your Won Of One logo
- **Use:** Browser favicon

## Design Recommendations

Based on your logo description:
- **Background:** Keep it transparent OR use a solid color (recommend keeping transparent)
- **Logo:** Use your stylized "1" with "WON OF ONE" text
- **For iOS:** Add 10% padding around edges (iOS rounds corners automatically)
- **For Android:** Use safe zone (center 80% of image) for important content

## Steps to Replace Icons

1. **Create your logo images** in the sizes listed above
2. **Save them** with the exact filenames specified
3. **Replace the existing files** in `assets/images/`
4. **Run:** `npx expo prebuild --clean` to regenerate native folders
5. **Build** your app to see the new icons

## Making the Icons

You can use tools like:
- **Figma** (free, web-based design tool)
- **Canva** (easy icon maker)
- **Photoshop/Illustrator** (professional)
- **Online tools:** https://appicon.co/ (generates all sizes from one image)

## Quick Start with One Image

If you have one 1024×1024 image:
1. Save it as `icon.png`
2. Copy it to `adaptive-icon.png`
3. Resize to 400×400 for `splash-icon.png`
4. Resize to 96×96 for `favicon.png`

## Testing Your Icons

After replacing the icons:
- **iOS Simulator:** `npx expo run:ios`
- **Android Emulator:** `npx expo run:android`
- **EAS Build:** Your next build will use the new icons

## Current Configuration

Your app.json is already configured to use these files:
- `icon.png` - Main app icon
- `splash-icon.png` - Splash screen
- `adaptive-icon.png` - Android adaptive icon
- `favicon.png` - Web favicon

Simply replace the files and rebuild!

