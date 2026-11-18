import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { SignUpDto } from './dto/signup.dto.js';
import { SignInDto } from './dto/signin.dto.js';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from './decorators/current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() data: SignUpDto) {
    return await this.authService.signUp(data);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() data: SignInDto) {
    return await this.authService.signIn(data);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signInAlias(@Body() data: SignInDto) {
    return await this.authService.signIn(data);
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return await this.authService.getMe(user.supabaseId);
  }
}
