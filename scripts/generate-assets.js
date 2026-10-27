#!/usr/bin/env node
/**
 * KosherAI - Automated Image Generation & Cloudinary Caching Utility
 * 
 * Generates photorealistic, culturally authentic Philippine culinary images using
 * Google Imagen 3 (@google/genai) and automatically caches optimized 300x300 WebP
 * thumbnails directly to Cloudinary under the `kosherai/` folder.
 * 
 * Usage:
 *   node scripts/generate-assets.js [--dry-run] [--force] [--limit N] [--id <itemId>]
 * 
 * Environment Variables (.env):
 *   GEMINI_API_KEY           - Google Gemini / Imagen API key
 *   CLOUDINARY_CLOUD_NAME    - Cloudinary Cloud Name
 *   CLOUDINARY_API_KEY       - Cloudinary API Key
 *   CLOUDINARY_API_SECRET    - Cloudinary API Secret
 *   CLOUDINARY_URL           - (Alternative) Full Cloudinary connection string
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FOOD_DATABASE } from '../src/data/lidDatabase.js';
import { DIET_RECIPES } from '../src/data/dietRecipes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPPING_FILE = path.resolve(__dirname, '../src/data/generatedImages.json');

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const targetIdIndex = args.indexOf('--id');
const targetId = targetIdIndex !== -1 ? args[targetIdIndex + 1] : null;
const limitIndex = args.indexOf('--limit');
const itemLimit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : Infinity;

/**
 * Constructs a photorealistic, culturally authentic Philippine culinary prompt
 */
export function craftFoodPrompt(item, isDish = false) {
  const name = item.name || item.title || 'Philippine Food';
  const desc = item.generalDescription || item.description || item.clinicalNote || '';

  if (isDish) {
    return (
      `Professional commercial food photography of traditional Filipino dish "${name}". ` +
      `Authentic home-cooked Philippine presentation in a rustic ceramic bowl or plate, ` +
      `garnished with fresh native calamansi, garlic, and herbs. Clean appetizing plating, ` +
      `neutral warm daylight studio lighting, shallow depth of field, 8k resolution, photorealistic, ` +
      `shot on 85mm f/1.8 lens, vibrant natural colors, steam gently rising, no artificial blur or text.`
    );
  }

  return (
    `Commercial studio product photography of Filipino culinary ingredient "${name}" (${desc}). ` +
    `Authentic Philippine market context, cleanly presented on a modern ceramic plate or small glass prep bowl, ` +
    `neutral textured kitchen surface background, bright soft daylight studio lighting, ` +
    `hyper-realistic food photography, crisp focus, fresh textures, 8k resolution, no watermark, no text.`
  );
}

/**
 * Generates an image using Imagen 3 via @google/genai or REST API
 */
async function generateImagenAsset(prompt, apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }

  // Attempt using @google/genai SDK if available
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1'
      }
    });

    if (response?.generatedImages?.[0]?.image?.imageBytes) {
      return response.generatedImages[0].image.imageBytes;
    }
  } catch (sdkErr) {
    // Fall back to direct Google AI Studio Imagen REST API
  }

  // REST API Fallback
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
  const payload = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      outputOptions: { mimeType: 'image/jpeg' }
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Imagen 3 API Error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const base64Bytes = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!base64Bytes) {
    throw new Error('Imagen 3 API returned no image bytes in response.');
  }

  return base64Bytes;
}

/**
 * Uploads base64 image buffer to Cloudinary with WebP and 300x300 thumbnail sizing
 */
async function uploadToCloudinary(base64Data, publicId, config) {
  const { cloudName, apiKey, apiSecret, cloudinaryUrl } = config;

  // Attempt using cloudinary npm package if installed
  try {
    const { v2: cloudinary } = await import('cloudinary');
    if (cloudinaryUrl) {
      cloudinary.config({ cloudinary_url: cloudinaryUrl });
    } else {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
      });
    }

    const uploadRes = await cloudinary.uploader.upload(`data:image/jpeg;base64,${base64Data}`, {
      folder: 'kosherai',
      public_id: publicId,
      format: 'webp',
      transformation: [
        { width: 300, height: 300, crop: 'fill', gravity: 'auto', quality: 'auto' }
      ]
    });

    return uploadRes.secure_url;
  } catch (sdkErr) {
    // Fallback to Cloudinary REST API
    if (!cloudName) {
      throw new Error('Cloudinary cloud name is required for image upload.');
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', `data:image/jpeg;base64,${base64Data}`);
    formData.append('folder', 'kosherai');
    formData.append('public_id', publicId);
    formData.append('format', 'webp');
    formData.append('transformation', 'w_300,h_300,c_fill,g_auto,q_auto');

    if (apiSecret && apiKey) {
      const crypto = await import('crypto');
      const timestamp = Math.floor(Date.now() / 1000);
      formData.append('timestamp', timestamp);
      formData.append('api_key', apiKey);
      
      const toSign = `folder=kosherai&format=webp&public_id=${publicId}&timestamp=${timestamp}&transformation=w_300,h_300,c_fill,g_auto,q_auto${apiSecret}`;
      const signature = crypto.createHash('sha1').update(toSign).digest('hex');
      formData.append('signature', signature);
    } else {
      // Unsigned upload preset fallback
      formData.append('upload_preset', 'kosherai_preset');
    }

    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Cloudinary REST error (${res.status}): ${errBody}`);
    }

    const resJson = await res.json();
    return resJson.secure_url;
  }
}

/**
 * Main execution routine
 */
async function main() {
  console.log('🖼️  Starting KosherAI Imagen/Cloudinary Image Generator Utility...\n');

  // Load existing mapping
  let generatedMap = {};
  if (fs.existsSync(MAPPING_FILE)) {
    try {
      generatedMap = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    } catch {
      generatedMap = {};
    }
  }

  // Gather all items from database and recipes
  const items = [];
  for (const food of FOOD_DATABASE) {
    items.push({ ...food, isDish: false });
  }

  for (const dietKey of Object.keys(DIET_RECIPES)) {
    for (const meal of DIET_RECIPES[dietKey].meals) {
      if (!items.some(i => i.id === meal.id)) {
        items.push({ ...meal, isDish: true });
      }
    }
  }

  // Filter candidates for generation
  const candidates = items.filter(item => {
    if (targetId && item.id !== targetId) return false;
    if (isForce) return true;
    return !generatedMap[item.id] && !item.imageUrl;
  }).slice(0, itemLimit);

  console.log(`Found ${candidates.length} item(s) eligible for automated image generation.`);

  if (candidates.length === 0) {
    console.log('✅ All items currently have valid URLs or cached Cloudinary assets.');
    console.log('   Use --force or --id <itemId> to regenerate specific items.\n');
    return;
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const cloudinaryConfig = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    cloudinaryUrl: process.env.CLOUDINARY_URL
  };

  let generatedCount = 0;

  for (const item of candidates) {
    const prompt = craftFoodPrompt(item, item.isDish);
    console.log(`\n➡️  [${item.id}] ${item.name}`);
    console.log(`   Prompt: "${prompt.slice(0, 90)}..."`);

    if (isDryRun) {
      console.log('   [Dry Run] Simulated generation and Cloudinary upload.');
      generatedMap[item.id] = `https://res.cloudinary.com/demo/image/upload/w_300,h_300,c_fill/kosherai/${item.id}.webp`;
      generatedCount++;
      continue;
    }

    try {
      console.log('   ⚡ Generating 1:1 image with Imagen 3...');
      const base64Bytes = await generateImagenAsset(prompt, geminiApiKey);

      console.log('   ☁️  Uploading to Cloudinary (kosherai/, 300x300, WebP)...');
      const secureUrl = await uploadToCloudinary(base64Bytes, item.id, cloudinaryConfig);

      generatedMap[item.id] = secureUrl;
      console.log(`   ✅ Success: ${secureUrl}`);
      generatedCount++;

      // Persist incrementally to prevent progress loss
      fs.writeFileSync(MAPPING_FILE, JSON.stringify(generatedMap, null, 2), 'utf8');
    } catch (err) {
      console.error(`   ❌ Failed for ${item.id}:`, err.message);
    }
  }

  // Final write
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(generatedMap, null, 2), 'utf8');
  console.log(`\n🎉 Processed ${generatedCount} asset(s). Mapping saved to ${MAPPING_FILE}!`);
}

// Execute if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}
