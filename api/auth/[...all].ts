// Vercel Serverless Function handler for Better Auth routes (/api/auth/*)
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../../lib/auth.ts';

export default toNodeHandler(auth);

