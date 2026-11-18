import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: number;
  supabaseId: string;
  email: string;
  role: string;
  isActive: boolean;
  wallet?: {
    id: number;
    currency: string;
  } | null;
  profile?: {
    id: number;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
  } | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);
