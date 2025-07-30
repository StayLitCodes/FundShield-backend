import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../entities/user.entity';

export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'isPublic';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Admin = () => Roles(UserRole.ADMIN);
export const Moderator = () => Roles(UserRole.MODERATOR, UserRole.ADMIN);
export const Auditor = () => Roles(UserRole.AUDITOR, UserRole.ADMIN);
export const User = () => Roles(UserRole.USER, UserRole.MODERATOR, UserRole.AUDITOR, UserRole.ADMIN); 