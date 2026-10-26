# KosherAI 🛡️

> An offline-first Low-Iodine Diet (LID) companion for patients undergoing Radioactive Iodine (RAI) therapy and their caregivers.

Preparing for RAI therapy requires a strict low-iodine regimen (<50 mcg iodine/day). **KosherAI** removes the guesswork in the kitchen and supermarket by delivering instant ingredient verification, optical label scanning, and clinical guidelines—even without an internet connection.

---

## 🚀 Features

- **🔍 Offline-First Ingredient Checker:** Instant fuzzy search across permitted, restricted, and high-caution ingredients using a local clinical database.
- **📸 Packaging & Label Scanner:** Client-side OCR and AI-assisted analysis to identify hidden iodine sources (e.g., iodized salt, carrageenan, iodate conditioners, egg yolks, dairy solids, Red Dye #3).
- **📋 Doctor-Verified Protocol Reference:** Clear traffic-light status system (Safe, Avoid, Caution) categorized by meat, produce, grains, oils, and additives.
- **🔄 Smart Substitutions:** Suggests safe culinary alternatives (e.g., sayote or squash instead of potatoes; pure non-iodized kosher salt instead of iodized rock salt).
- **🍳 Meal & Cook Mode:** Interactive pre-cooking checklist and recipe ingredient tester.
- **📱 PWA Ready:** Installable on iOS and Android devices with service worker caching for offline supermarket use.

---

## 🏥 Core Diet Guidelines

| Category | Safe (Allowed) 🟢 | Prohibited (Avoid) 🔴 |
| :--- | :--- | :--- |
| **Salts & Seasonings** | Pure non-iodized kosher salt, black/white pepper, fresh chilies, pure herbs | Standard iodized salt, rock salt, sea salt, Himalayan salt |
| **Proteins** | Fresh unbrined chicken, pork, beef, pure egg whites | Whole eggs, egg yolks, seafood, fish, tuna, shrimp, turkey breast |
| **Produce** | Carrots, sayote (chayote), squash, bell peppers, tomatoes, garlic, onions | Potatoes, seaweed, kelp, cassava, cruciferous greens (cabbage, broccoli) |
| **Grains** | Plain white/brown rice, unbleached flour, pure cornstarch, oats, egg-free dry pasta | Commercial bakery white bread made with iodate dough conditioners |
| **Additives & Dyes** | Citric acid, ascorbic acid, pure fruit pectin | Carrageenan (E407), agar-agar (E406), alginates, FD&C Red Dye #3 (E127) |

---

## 🛠️ Technology Stack

- **Framework:** Vanilla JavaScript (ES Modules) + Vite
- **Styling:** Vanilla CSS design system with medical aesthetic & responsive touch targets
- **Offline Storage:** Service Worker (`sw.js`) + LocalStorage + Local JSON Database
- **Vision & AI:** PaddleOCR (PP-OCRv4 ONNX Runtime Web) + Google Gemini 2.5 Flash Vision API endpoint
- **PWA:** Web App Manifest (`manifest.webmanifest`)