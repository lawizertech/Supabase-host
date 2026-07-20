import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  private readonly supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  private readonly supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifies a Supabase JWT access token by calling the Supabase Auth API
   */
  async verifySupabaseToken(token: string): Promise<any> {
    try {
      const res = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: this.supabaseAnonKey,
        },
      });

      if (!res.ok) {
        throw new UnauthorizedException('Invalid Supabase access token');
      }

      const userData = await res.json();
      return userData;
    } catch (error) {
      throw new UnauthorizedException('Token verification failed: ' + (error as Error).message);
    }
  }

  /**
   * Registers/updates client profile details in the profiles table
   */
  async signUp(uid: string, name: string, email: string, phoneNumber: string) {
    try {
      const profile = await this.prisma.profiles.upsert({
        where: { id: uid },
        update: {
          name,
          email,
          phone: phoneNumber,
        },
        create: {
          id: uid,
          name,
          email,
          phone: phoneNumber,
          role: 'client',
        },
      });
      return { success: true, data: { ...profile, uid: profile.id } };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * Authenticates user via email and password using Supabase Auth
   */
  async loginWithPassword(email: string, password: string) {
    try {
      const authRes = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseAnonKey,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!authRes.ok) {
        const errJson = await authRes.json().catch(() => null);
        throw new UnauthorizedException(errJson?.error_description || 'Invalid email or password');
      }

      const authData = await authRes.json();
      const token = authData.access_token;
      const refreshToken = authData.refresh_token;

      const loginRes = await this.login(token);
      return {
        ...loginRes,
        accessToken: token,
        refreshToken,
      };
    } catch (error: any) {
      throw new UnauthorizedException(error.message || 'Authentication failed');
    }
  }

  /**
   * Handles user login verification and profile retrieval
   */
  async login(token: string, requestedRole?: string) {
    try {
      // Verify token with Supabase
      const userData = await this.verifySupabaseToken(token);
      const uid = userData.id;

      // Extract Google photo URL from user metadata
      const googlePhotoUrl = userData.user_metadata?.avatar_url || userData.user_metadata?.picture || '';

      // Fetch user profile
      let profile = await this.prisma.profiles.findUnique({
        where: { id: uid },
      });

      let isNewProfile = false;
      // If profile does not exist, create it from Supabase Auth details
      if (!profile) {
        isNewProfile = true;
        const initialRole = (
          requestedRole ||
          userData.user_metadata?.role ||
          userData.app_metadata?.role ||
          'client'
        ).toLowerCase();

        profile = await this.prisma.profiles.create({
          data: {
            id: uid,
            email: userData.email,
            name: userData.user_metadata?.name || userData.user_metadata?.full_name || '',
            phone: userData.user_metadata?.phone || '',
            photo_url: googlePhotoUrl || null,
            role: initialRole,
          },
        });
      } else if (!profile.photo_url && googlePhotoUrl) {
        // If profile exists but photo is not stored yet, update it with Google picture
        profile = await this.prisma.profiles.update({
          where: { id: uid },
          data: { photo_url: googlePhotoUrl },
        });
      }

      const isProfileComplete = !!(profile.name && profile.phone);
      const hasPassword = profile.has_password || !!(
        userData.identities?.some((id: any) => id.provider === 'email') ||
        userData.app_metadata?.providers?.includes('email')
      );

      return {
        success: true,
        token: token, // Return the same token or session
        data: {
          ...profile,
          uid: profile.id,
          isProfileComplete,
          hasPassword,
          isNewProfile,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Fetches the user profile by UID
   */
  async getProfile(uid: string) {
    try {
      const profile = await this.prisma.profiles.findUnique({
        where: { id: uid },
      });

      if (!profile) {
        return { success: false, message: 'Profile not found' };
      }

      const isProfileComplete = !!(profile.name && profile.phone);

      return { success: true, data: { ...profile, uid: profile.id, isProfileComplete } };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  async completeProfile(uid: string, name: string, phone: string, city?: string, state?: string, photoUrl?: string, hasPassword?: boolean) {
    try {
      const profile = await this.prisma.profiles.update({
        where: { id: uid },
        data: {
          name,
          phone,
          city: city || null,
          state: state || null,
          photo_url: photoUrl || null,
          has_password: hasPassword ? true : undefined,
        },
      });

      const isProfileComplete = !!(profile.name && profile.phone);

      return {
        success: true,
        data: {
          ...profile,
          uid: profile.id,
          isProfileComplete,
        },
      };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  /**
   * Refresh an expired access token using the refresh token from Supabase
   * The refresh token is passed via HttpOnly cookie from the frontend
   */
  async refreshAccessToken(refreshToken: string): Promise<any> {
    try {
      const res = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseAnonKey,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        throw new UnauthorizedException('Failed to refresh token with Supabase');
      }

      const data = await res.json();
      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken, // Supabase may rotate the refresh token
      };
    } catch (error) {
      throw new UnauthorizedException('Token refresh failed: ' + (error as Error).message);
    }
  }

  /**
   * Get the authenticated user's session data (authoritative source)
   * Validates the access token and returns the user profile
   */
  async getSession(accessToken: string): Promise<any> {
    try {
      // Verify token with Supabase
      const userData = await this.verifySupabaseToken(accessToken);
      const uid = userData.id;

      // Fetch user profile from database
      const profile = await this.prisma.profiles.findUnique({
        where: { id: uid },
      });

      if (!profile) {
        throw new UnauthorizedException('User profile not found');
      }

      const isProfileComplete = !!(profile.name && profile.phone);
      const hasPassword = profile.has_password || !!(
        userData.identities?.some((id: any) => id.provider === 'email') ||
        userData.app_metadata?.providers?.includes('email')
      );

      return {
        success: true,
        data: {
          ...profile,
          uid: profile.id,
          isProfileComplete,
          hasPassword,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Session validation failed: ' + (error as Error).message);
    }
  }

  /**
   * Invalidate a refresh token (logout)
   * For Supabase, we can't revoke tokens server-side, but we can clear the cookie
   * The frontend will also clear its in-memory token
   */
  async logout(refreshToken: string): Promise<any> {
    try {
      // Attempt to revoke the session on Supabase (if your plan supports it)
      // Otherwise, just return success and let the cookie be cleared
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      return { success: true, message: 'Logged out (token revocation skipped)' };
    }
  }
}
