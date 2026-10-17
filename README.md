# Ballast

Weight and BMI log that shows the trend, not the noisy scale. A Kalman filter
learns your normal day-to-day swing and day-of-week pattern, tells you when the
current trend reaches your target (with a likely range), checks your goal
against your own pace limit with verified ways to make it fit, and explains
every reading: trend + weekday + noise.

- Expo SDK 54, expo-router, expo-sqlite, reanimated, gesture-handler, react-native-svg
- No backend, no network permission. Optional morning reminder (installed build only).
- Informational only — not medical advice.

```
npm install
npx expo start          # Expo Go
npm run verify          # tsc + tests + rules + export
```

Engine and design notes: [PLAN.md](PLAN.md).
