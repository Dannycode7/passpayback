import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  public readonly client: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const rawUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      '';
    const supabaseKey =
      this.configService.get<string>('SUPABASE_KEY') ||
      process.env.SUPABASE_KEY ||
      '';

    let supabaseUrl = rawUrl.trim();
    if (supabaseUrl.endsWith('/')) {
      supabaseUrl = supabaseUrl.slice(0, -1);
    }
    if (supabaseUrl.endsWith('/rest/v1')) {
      supabaseUrl = supabaseUrl.replace(/\/rest\/v1$/, '');
    }

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        'SUPABASE_URL ou SUPABASE_KEY manquant dans la configuration (.env)',
      );
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}
