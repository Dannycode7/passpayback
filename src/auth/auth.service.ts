import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Currency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import { SignUpDto } from './dto/signup.dto.js';
import { SignInDto } from './dto/signin.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  
  async signUp(dto: SignUpDto) {
    const { email, password, username } = dto;

    if (!email || !password || !username) {
      throw new BadRequestException(
        'L’email, le mot de passe et le nom d’utilisateur sont requis.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà.');
    }

    const { data, error } = await this.supabase.client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (error || !data.user) {
      if (error?.message?.toLowerCase().includes('invalid api key')) {
        throw new BadRequestException(
          'Clé SUPABASE_KEY invalide : Vous devez copier la clé "service_role" (commençant par eyJ...) depuis Supabase > Project Settings > API, et non le JWT Secret.',
        );
      }
      throw new BadRequestException(
        error?.message || 'Erreur lors de la création du compte.',
      );
    }

    const user = await this.prisma.user.create({
      data: {
        supabaseId: data.user.id,
        email,
        profile: {
          create: {
            username,
          },
        },
        wallet: {
          create: {
            currency: Currency.USD,
          },
        },
      },
      include: {
        profile: true,
        wallet: true,
      },
    });

    return {
      message: 'Compte créé avec succès.',
      user,
    };
  }

  /**
   * Connexion avec email et mot de passe via Supabase
   */
  async signIn(dto: SignInDto) {
    const { email, password } = dto;

    if (!email || !password) {
      throw new BadRequestException('Email et mot de passe requis.');
    }

    const { data, error } =
      await this.supabase.client.auth.signInWithPassword({
        email,
        password,
      });

    if (error || !data.session) {
      throw new UnauthorizedException(
        error?.message || 'Identifiants invalides.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { supabaseId: data.user.id },
      include: {
        profile: true,
        wallet: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Profil utilisateur introuvable en base locale.',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte utilisateur a été désactivé.');
    }

    return {
      message: 'Connexion réussie.',
      user,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        tokenType: data.session.token_type,
      },
    };
  }

  /**
   * Récupération du profil complet de l'utilisateur connecté
   */
  async getMe(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      include: {
        profile: true,
        wallet: {
          include: {
            transactions: {
              take: 10,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    return user;
  }
}
