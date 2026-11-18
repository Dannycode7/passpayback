import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaMock: any;
  let supabaseMock: any;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    supabaseMock = {
      client: {
        auth: {
          admin: {
            createUser: vi.fn(),
          },
          signInWithPassword: vi.fn(),
        },
      },
    };

    authService = new AuthService(prismaMock, supabaseMock);
  });

  it('devrait rejeter si email ou mot de passe manquant', async () => {
    await expect(
      authService.signUp({ email: '', password: '', username: '' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('devrait rejeter si l’utilisateur existe déjà', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 1, email: 'test@example.com' });

    await expect(
      authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('devrait créer l’utilisateur avec son profil et son portefeuille', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    supabaseMock.client.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'supabase-uuid-123' } },
      error: null,
    });
    prismaMock.user.create.mockResolvedValue({
      id: 1,
      supabaseId: 'supabase-uuid-123',
      email: 'new@example.com',
      profile: { username: 'newuser' },
      wallet: { id: 10, currency: 'USD' },
    });

    const result = await authService.signUp({
      email: 'new@example.com',
      password: 'securePassword123',
      username: 'newuser',
    });

    expect(result.user.email).toBe('new@example.com');
    expect(result.user.wallet.id).toBe(10);
    expect(prismaMock.user.create).toHaveBeenCalled();
  });
});
