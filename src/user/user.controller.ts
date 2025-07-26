import { Controller, Post, Get, Put, Body, Param, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto, UpdateProfileDto, SubmitKycDto, UpdatePreferenceDto, UserSearchFilterDto } from './dto/user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from './services/file-upload.service';
import { Express } from 'express';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService, private readonly fileUploadService: FileUploadService) {}

  @Post('register')
  async register(@Body() dto: RegisterUserDto) {
    return this.userService.register(dto);
  }

  @Get('profile/:userId')
  async getProfile(@Param('userId') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Put('profile/:userId')
  async updateProfile(@Param('userId') userId: string, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(userId, dto);
  }

  @Post('kyc/:userId')
  async submitKyc(@Param('userId') userId: string, @Body() dto: SubmitKycDto) {
    return this.userService.submitKyc(userId, dto);
  }

  @Put('preference/:userId')
  async updatePreference(@Param('userId') userId: string, @Body() dto: UpdatePreferenceDto) {
    return this.userService.updatePreference(userId, dto);
  }

  @Post('activity/:userId')
  async logActivity(@Param('userId') userId: string, @Body('action') action: string, @Body('metadata') metadata?: Record<string, any>) {
    return this.userService.logActivity(userId, action, metadata);
  }

  @Get('search')
  async searchUsers(@Query() filter: UserSearchFilterDto) {
    return this.userService.searchUsers(filter);
  }

  @Put('suspend/:userId')
  async suspendUser(@Param('userId') userId: string, @Body('reason') reason: string) {
    return this.userService.suspendUser(userId, reason);
  }

  @Put('recover/:userId')
  async recoverUser(@Param('userId') userId: string) {
    return this.userService.recoverUser(userId);
  }

  @Post('upload/profile-picture/:userId')
  @UseInterceptors(FileInterceptor('file', (new FileUploadService()).getMulterOptions('profile-pictures')))
  async uploadProfilePicture(@Param('userId') userId: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const url = this.fileUploadService.getFileUrl('profile-pictures', file.filename);
    // Optionally update user profile with new picture URL
    await this.userService.updateProfile(userId, { profilePictureUrl: url });
    return { url };
  }

  @Post('upload/kyc-document/:userId')
  @UseInterceptors(FileInterceptor('file', (new FileUploadService()).getMulterOptions('kyc-documents')))
  async uploadKycDocument(@Param('userId') userId: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const url = this.fileUploadService.getFileUrl('kyc-documents', file.filename);
    await this.userService.addKycDocument(userId, { type: file.mimetype, url });
    return { url };
  }
} 