import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Token d’authentification manquant ou invalide.',
      );
    }

    const token = authHeader.split(' ')[1];

    try {
      const { data, error } =
        await this.supabaseService.client.auth.getUser(token);

      if (error || !data.user) {
        throw new UnauthorizedException(
          error?.message || 'Session invalide ou expirée.',
        );
      }

      // Synchronisation avec la base de données locale Prisma
      const user = await this.prismaService.user.findUnique({
        where: { supabaseId: data.user.id },
        include: {
          profile: true,
          wallet: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException(
          'Utilisateur non trouvé dans la base locale.',
        );
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Compte utilisateur désactivé.');
      }

      request.user = user;
      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException(
        'Erreur lors de la validation du token.',
      );
    }
  }
}
