"use server";

import { getAdminAuth } from './firebaseAdmin';

export async function adminCreateFirebaseUser(email: string, displayName: string) {
  try {
    const auth = getAdminAuth();
    
    // Check if user already exists
    try {
      const existingUser = await auth.getUserByEmail(email);
      if (existingUser) {
        return { success: true, userRecord: existingUser, isNew: false };
      }
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    // Create the user
    // Generate a secure random placeholder password if none is given, 
    // the user will receive a password reset link to actually set their own.
    const randomPassword = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(36)).join('').slice(0, 16) + 'A1!';

    const newUser = await auth.createUser({
      email,
      displayName,
      password: randomPassword,
    });

    return { 
      success: true, 
      userRecord: newUser, 
      isNew: true, 
      tempPassword: randomPassword 
    };

  } catch (error: any) {
    console.error('[adminCreateFirebaseUser] error:', error);
    return { success: false, error: error.message };
  }
}

export async function adminGeneratePasswordResetLink(email: string) {
  try {
    const auth = getAdminAuth();
    const link = await auth.generatePasswordResetLink(email);
    return { success: true, link };
  } catch (error: any) {
    console.error('[adminGeneratePasswordResetLink] error:', error);
    return { success: false, error: error.message };
  }
}
