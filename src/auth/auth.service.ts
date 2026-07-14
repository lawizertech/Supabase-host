import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  private readonly supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
   * Handles user login verification and profile retrieval
   */
  async login(token: string) {
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

      // If profile does not exist, create it from Supabase Auth details
      if (!profile) {
        profile = await this.prisma.profiles.create({
          data: {
            id: uid,
            email: userData.email,
            name: userData.user_metadata?.name || userData.user_metadata?.full_name || '',
            phone: userData.user_metadata?.phone || '',
            photo_url: googlePhotoUrl || null,
            role: 'client',
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
}
